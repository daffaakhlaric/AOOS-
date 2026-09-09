import { err, ok, type Result } from "@aos/common";
import type { Logger } from "@aos/logger";
import type { getTracer } from "@aos/telemetry";

import type { IMetaAdsClient } from "../../contracts/IMetaAdsClient.js";
import type { IRateLimiter } from "../../contracts/IRateLimiter.js";
import type { Ad } from "../../domain/entities/Ad.js";
import { AdAccount } from "../../domain/entities/AdAccount.js";
import type { AdSet } from "../../domain/entities/AdSet.js";
import type { Campaign } from "../../domain/entities/Campaign.js";
import { MetaApiError, RateLimitError } from "../../domain/errors/index.js";
import type { MetaAdsConnectorEvents } from "../../domain/events/MetaAdsConnectorEvents.js";
import { evaluateVerdict } from "../../domain/services/VerdictEngine.js";
import type { AdAccountId } from "../../domain/value-objects/AdAccountId.js";
import { MetaResponseMapper } from "../../infrastructure/meta-api/MetaResponseMapper.js";
import type { ExponentialBackoffRetry } from "../../infrastructure/retry/ExponentialBackoffRetry.js";
import type { AdAccountRegistry } from "../../registry/AdAccountRegistry.js";
import type {
  MetaAd,
  MetaAdSet,
  MetaAdSetExpanded,
  MetaCampaignExpanded,
} from "../../types/MetaApiTypes.js";
import { assignCampaignStableIds } from "../../utils/StableIdAssigner.js";

import { callMetaApi, extractOrFetch, fetchAllPages } from "./meta-api-call-helpers.js";

/**
 * Real, currently-broken-in-production compounding-pulls fix — the minimum real time that must
 * pass between two Meta pulls for the SAME ad account before this use case will start a new one.
 * `PullCampaignData.execute` is the single real choke point every call site in `apps/aaos-api`
 * goes through for a live Meta pull (`MetaSyncService.syncCampaign`'s realtime post-action hook,
 * `MetaSyncService.syncOnce`'s 15-minute cron sweep AND daily snapshot, and
 * `MetaAdsService.pullAdAccount`'s manual "Tarik Data Baru"/dashboard-mount pull — verified by
 * reading every one of those call sites, all of which call `connector.pullCampaignData.execute`
 * and nothing else) — so guarding HERE, once, is the real fix for those 3+ independent triggers
 * compounding into near-simultaneous real Meta traffic for one tenant, rather than trying to
 * coordinate each call site separately. 60s is deliberately short relative to the 15-minute cron
 * cadence — it only needs to collapse triggers landing within the same short burst (e.g. a
 * dashboard auto-pull-on-mount firing seconds after a cron tick, or a user's manual click landing
 * right after `syncCampaign`'s post-create hook), not to throttle legitimately-spaced-out pulls.
 */
const DEFAULT_MIN_PULL_INTERVAL_MS = 60_000;

/** Local alias avoiding a direct `@opentelemetry/api` dependency (not in this package's `package.json` — `@aos/telemetry` is the sanctioned entry point per the Technical Requirements). */
export type Tracer = ReturnType<typeof getTracer>;

/**
 * EYVRA-META-OAUTH-WHATSAPP-SETUP Sprint 4 — `"today"`/`"yesterday"` added, additive. Both are
 * real, Meta-documented `date_preset` literal values (Meta Marketing API "Insights" reference),
 * exactly like the 3 pre-existing presets — `MetaApiRequestBuilder`'s `insightsExpansion` already
 * passes `datePreset` straight through as an opaque string with no allowlist of its own, so this is
 * a pure type/validation widening, not a new capability. Added so `MetaSyncService`'s periodic
 * (15-minute) and daily-snapshot syncs can request a genuinely narrower real window than
 * `last_7d`/`last_14d`/`last_30d` without this package needing a separate `time_range`+
 * `time_increment=1` day-partitioned Insights capability (a materially larger, separate change —
 * see `050_meta_sync.sql`'s header note for the full scope-boundary reasoning).
 */
export type DatePreset = "last_7d" | "last_14d" | "last_30d" | "today" | "yesterday";

export interface PullCampaignDataInput {
  readonly adAccountId: AdAccountId;
  readonly datePreset: DatePreset;
  readonly accessToken: string;
  readonly tenantId: string;
  readonly correlationId: string;
  /** AAOS does not call a dedicated "ad account details" Meta endpoint (not part of the spec's
   * Meta API Integration section) — these are supplied by the caller (e.g. from `apps/aaos-api`
   * config) and default to placeholders when omitted. See README "Known limitations". */
  readonly adAccountName?: string;
  readonly businessManagerId?: string;
}

const VALID_DATE_PRESETS: ReadonlySet<string> = new Set([
  "last_7d",
  "last_14d",
  "last_30d",
  "today",
  "yesterday",
]);

/**
 * Pulls the full campaign → adset → ad hierarchy for one Meta ad account, per the spec's
 * "PullCampaignData" step sequence (validate → fetch campaigns [paginated] → fetch adsets per
 * campaign [paginated] → fetch ads-with-insights per adset [paginated] → map raw → domain →
 * compute D2/D3/D5 [inside MetricsMapper] → compute Rp/D3, Rp/chat, Rp/lead [inside AdMetrics] →
 * apply verdict per ad → assign stable #A/#B/#C ids → classify branch/funnel [inside mappers] →
 * emit SyncCompleted → return AdAccount).
 */
export class PullCampaignData {
  /**
   * Real, currently-broken-in-production compounding-pulls fix — real wall-clock time (ms since
   * epoch, via the injected `now` clock) each ad account's most recent pull ATTEMPT started.
   * In-memory/per-instance is the correct scope: `MetaAdsConnectorRegistry.resolve(tenantId)`
   * (`apps/aaos-api`) caches exactly ONE `MetaAdsConnector` — and therefore one `PullCampaignData`
   * instance — per tenant for the lifetime of the process, so this map is naturally
   * per-tenant-per-process, matching the real single choke point this guard exists to protect.
   */
  private readonly lastPullStartedAtMs = new Map<string, number>();

  constructor(
    private readonly client: IMetaAdsClient,
    private readonly rateLimiter: IRateLimiter,
    private readonly retry: ExponentialBackoffRetry,
    private readonly registry: AdAccountRegistry,
    private readonly events: MetaAdsConnectorEvents,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
    private readonly now: () => Date = () => new Date(),
    private readonly minPullIntervalMs: number = DEFAULT_MIN_PULL_INTERVAL_MS,
  ) {}

  async execute(input: PullCampaignDataInput): Promise<Result<AdAccount, MetaApiError>> {
    return this.tracer.startActiveSpan(
      "meta-ads-connector.pull-campaign-data",
      async (span: { end: () => void }) => {
        try {
          const result = await this.run(input);
          if (!result.ok) {
            await this.events.publishSyncFailed({
              adAccountId: input.adAccountId.toString(),
              reason: result.error.message,
              errorCode: result.error.code,
              tenantId: input.tenantId,
              correlationId: input.correlationId,
              occurredAt: this.now(),
              version: "1.0",
            });
          }
          return result;
        } finally {
          span.end();
        }
      },
    );
  }

  private async run(input: PullCampaignDataInput): Promise<Result<AdAccount, MetaApiError>> {
    if (!VALID_DATE_PRESETS.has(input.datePreset)) {
      return err(
        invalidInputError(
          `datePreset must be one of last_7d|last_14d|last_30d|today|yesterday, received: ${input.datePreset}`,
        ),
      );
    }

    const adAccountKey = input.adAccountId.toString();
    const throttleResult = this.checkPullInterval(adAccountKey);
    if (!throttleResult.ok) {
      return throttleResult;
    }

    this.logger.info({ adAccountId: adAccountKey }, "meta-ads-connector: sync starting");

    const rawCampaignsResult = await fetchAllPages<MetaCampaignExpanded>((cursor) =>
      callMetaApi(this.rateLimiter, this.retry, () =>
        this.client.getCampaignsExpanded(adAccountKey, input.accessToken, input.datePreset, cursor),
      ),
    );
    if (!rawCampaignsResult.ok) {
      return rawCampaignsResult;
    }

    const campaignsResult = MetaResponseMapper.mapCampaigns(
      rawCampaignsResult.value,
      input.adAccountId,
    );
    if (!campaignsResult.ok) {
      return err(invalidInputError(campaignsResult.error.message));
    }

    const hydratedCampaigns: Campaign[] = [];
    for (let i = 0; i < campaignsResult.value.length; i += 1) {
      const campaign = campaignsResult.value[i];
      const rawCampaign = rawCampaignsResult.value[i];
      if (campaign === undefined || rawCampaign === undefined) {
        continue;
      }
      const hydratedResult = await this.hydrateCampaign(campaign, rawCampaign, input);
      if (!hydratedResult.ok) {
        return hydratedResult;
      }
      hydratedCampaigns.push(hydratedResult.value);
    }

    // Unreachable via any real Meta response: `assignCampaignStableIds` can only fail on a
    // >999-item StableId sequence overflow, and `MetaResponseMapper.mapCampaigns` above already
    // assigns a same-capped placeholder `#A<n>` sequence to the identical-length `hydratedCampaigns`
    // array — so a >999-campaign sync always fails earlier, at the `campaignsResult.ok` check.
    const stableIdResult = assignCampaignStableIds(hydratedCampaigns);
    /* v8 ignore next 3 */
    if (!stableIdResult.ok) {
      return err(invalidInputError(stableIdResult.error.message));
    }

    const adAccountResult = AdAccount.create({
      id: input.adAccountId,
      name: input.adAccountName ?? input.adAccountId.toString(),
      businessManagerId: input.businessManagerId ?? "unknown",
      currency: "IDR",
      timezone: "Asia/Jakarta",
      campaigns: stableIdResult.value,
      syncedAt: this.now(),
    });
    if (!adAccountResult.ok) {
      return err(invalidInputError(adAccountResult.error.message));
    }

    this.registry.save(adAccountResult.value);

    const campaignCount = adAccountResult.value.campaigns.length;
    const adSetCount = adAccountResult.value.campaigns.reduce((sum, c) => sum + c.adSets.length, 0);
    const adCount = adAccountResult.value.campaigns.reduce(
      (sum, c) => sum + c.adSets.reduce((s, as) => s + as.ads.length, 0),
      0,
    );

    await this.events.publishSyncCompleted({
      adAccountId: input.adAccountId.toString(),
      campaignCount,
      adSetCount,
      adCount,
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      occurredAt: this.now(),
      version: "1.0",
    });

    this.logger.info(
      { adAccountId: input.adAccountId.toString(), campaignCount, adSetCount, adCount },
      "meta-ads-connector: sync completed",
    );

    return ok(adAccountResult.value);
  }

  /**
   * N+1-fanout fix — `rawCampaign.adsets` is the nested `adsets.limit(N){...}` edge already
   * returned by the single `getCampaignsExpanded` call in `run()`. `extractOrFetch` uses it
   * directly when it's genuinely the WHOLE list (no `paging.next`); only when it overflowed that
   * page size (or is absent — see `extractOrFetch`'s own doc) does this fall back to the
   * pre-existing, fully-paginated `getAdSets` edge call, scoped to just this one campaign.
   */
  private async hydrateCampaign(
    campaign: Campaign,
    rawCampaign: MetaCampaignExpanded,
    input: PullCampaignDataInput,
  ): Promise<Result<Campaign, MetaApiError>> {
    const rawAdSetsResult = await extractOrFetch<MetaAdSetExpanded>(rawCampaign.adsets, () =>
      fetchAllPages<MetaAdSet>((cursor) =>
        callMetaApi(this.rateLimiter, this.retry, () =>
          this.client.getAdSets(campaign.metaId, input.accessToken, cursor),
        ),
      ),
    );
    if (!rawAdSetsResult.ok) {
      return rawAdSetsResult;
    }

    const adSetsResult = MetaResponseMapper.mapAdSets(
      rawAdSetsResult.value,
      campaign.id,
      input.adAccountId,
    );
    if (!adSetsResult.ok) {
      return err(invalidInputError(adSetsResult.error.message));
    }

    const hydratedAdSets: AdSet[] = [];
    for (let i = 0; i < adSetsResult.value.length; i += 1) {
      const adSet = adSetsResult.value[i];
      const rawAdSet = rawAdSetsResult.value[i];
      if (adSet === undefined) {
        continue;
      }
      const hydratedResult = await this.hydrateAdSet(adSet, rawAdSet, campaign, input);
      if (!hydratedResult.ok) {
        return hydratedResult;
      }
      hydratedAdSets.push(hydratedResult.value);
    }

    return ok(campaign.withAdSets(hydratedAdSets));
  }

  /** N+1-fanout fix — same `extractOrFetch` pattern as `hydrateCampaign`, one level down (`rawAdSet.ads` falling back to the pre-existing paginated `getAds` edge call, scoped to just this one adset). `rawAdSet` is `undefined` when the fallback branch above sourced this adset from the (non-expanded) `getAdSets` call, which never carries a nested `ads` edge — `extractOrFetch` treats that identically to an overflowed/absent nested edge. */
  private async hydrateAdSet(
    adSet: AdSet,
    rawAdSet: MetaAdSetExpanded | undefined,
    campaign: Campaign,
    input: PullCampaignDataInput,
  ): Promise<Result<AdSet, MetaApiError>> {
    const rawAdsResult = await extractOrFetch<MetaAd>(rawAdSet?.ads, () =>
      fetchAllPages<MetaAd>((cursor) =>
        callMetaApi(this.rateLimiter, this.retry, () =>
          this.client.getAds(adSet.metaId, input.accessToken, input.datePreset, cursor),
        ),
      ),
    );
    if (!rawAdsResult.ok) {
      return rawAdsResult;
    }

    const adsResult = MetaResponseMapper.mapAds(
      rawAdsResult.value,
      campaign.id,
      adSet.id,
      input.adAccountId,
      campaign.funnel,
      adSet.branch,
      this.now(),
    );
    if (!adsResult.ok) {
      return err(invalidInputError(adsResult.error.message));
    }

    const adsWithVerdicts: Ad[] = adsResult.value.map((ad) => {
      const verdict = evaluateVerdict({
        rphChat: ad.metrics.rphChat,
        conversations: ad.metrics.conversations,
        spendAmount: ad.metrics.spend.toNumber(),
        frequency: ad.metrics.frequency,
        objective: campaign.objective,
      });
      return ad.withVerdict(verdict);
    });

    return ok(adSet.withAds(adsWithVerdicts));
  }

  /**
   * Real, currently-broken-in-production compounding-pulls fix — see `DEFAULT_MIN_PULL_INTERVAL_MS`
   * and `lastPullStartedAtMs`'s own docstrings for the full "why here" reasoning. `Result.ok` lets
   * the pull proceed (and records `adAccountKey`'s new `lastPullStartedAtMs` so a following call
   * within the window is blocked); `Result.err` short-circuits BEFORE any Meta HTTP call — same
   * "fail fast, no network call" discipline `TokenBucketRateLimiter.tryConsume` already
   * establishes for the local hourly budget, just scoped to real-time compounding instead.
   */
  private checkPullInterval(adAccountKey: string): Result<void, RateLimitError> {
    const nowMs = this.now().getTime();
    const lastStartedAtMs = this.lastPullStartedAtMs.get(adAccountKey);
    if (lastStartedAtMs !== undefined) {
      const elapsedMs = nowMs - lastStartedAtMs;
      if (elapsedMs < this.minPullIntervalMs) {
        const remainingMs = this.minPullIntervalMs - elapsedMs;
        return err(
          new RateLimitError(
            `Sedang dibatasi — penarikan data Meta untuk akun iklan ini baru saja dilakukan, coba lagi dalam ${Math.ceil(
              remainingMs / 1000,
            )} detik (minimum-pull-interval guard: ${Math.round(this.minPullIntervalMs / 1000)}s, ad account "${adAccountKey}"). Real fix for the cron sweep / realtime post-action hook / manual "Tarik Data Baru" click compounding into simultaneous live Meta traffic for the same tenant.`,
            remainingMs,
          ),
        );
      }
    }
    this.lastPullStartedAtMs.set(adAccountKey, nowMs);
    return ok(undefined);
  }
}

/** Wraps a domain-level mapping failure (e.g. an unrecognized objective/status, a malformed date) as a `MetaApiError` so `execute()` keeps a single error channel — mapping failures are just as "this sync cannot complete" as a transport failure, from the caller's perspective. */
function invalidInputError(message: string): MetaApiError {
  return new MetaApiError(message);
}

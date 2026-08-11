import { err, ok, type Result } from "@aos/common";
import type { Logger } from "@aos/logger";
import type { getTracer } from "@aos/telemetry";

import type { IMetaAdsClient } from "../../contracts/IMetaAdsClient.js";
import type { IRateLimiter } from "../../contracts/IRateLimiter.js";
import type { Ad } from "../../domain/entities/Ad.js";
import { AdAccount } from "../../domain/entities/AdAccount.js";
import type { AdSet } from "../../domain/entities/AdSet.js";
import type { Campaign } from "../../domain/entities/Campaign.js";
import { MetaApiError } from "../../domain/errors/index.js";
import type { MetaAdsConnectorEvents } from "../../domain/events/MetaAdsConnectorEvents.js";
import { evaluateVerdict } from "../../domain/services/VerdictEngine.js";
import type { AdAccountId } from "../../domain/value-objects/AdAccountId.js";
import { MetaResponseMapper } from "../../infrastructure/meta-api/MetaResponseMapper.js";
import type { ExponentialBackoffRetry } from "../../infrastructure/retry/ExponentialBackoffRetry.js";
import type { AdAccountRegistry } from "../../registry/AdAccountRegistry.js";
import type { MetaAd, MetaAdSet, MetaCampaign } from "../../types/MetaApiTypes.js";
import { assignCampaignStableIds } from "../../utils/StableIdAssigner.js";

import { callMetaApi, fetchAllPages } from "./meta-api-call-helpers.js";

/** Local alias avoiding a direct `@opentelemetry/api` dependency (not in this package's `package.json` — `@aos/telemetry` is the sanctioned entry point per the Technical Requirements). */
export type Tracer = ReturnType<typeof getTracer>;

export type DatePreset = "last_7d" | "last_14d" | "last_30d";

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

const VALID_DATE_PRESETS: ReadonlySet<string> = new Set(["last_7d", "last_14d", "last_30d"]);

/**
 * Pulls the full campaign → adset → ad hierarchy for one Meta ad account, per the spec's
 * "PullCampaignData" step sequence (validate → fetch campaigns [paginated] → fetch adsets per
 * campaign [paginated] → fetch ads-with-insights per adset [paginated] → map raw → domain →
 * compute D2/D3/D5 [inside MetricsMapper] → compute Rp/D3, Rp/chat, Rp/lead [inside AdMetrics] →
 * apply verdict per ad → assign stable #A/#B/#C ids → classify branch/funnel [inside mappers] →
 * emit SyncCompleted → return AdAccount).
 */
export class PullCampaignData {
  constructor(
    private readonly client: IMetaAdsClient,
    private readonly rateLimiter: IRateLimiter,
    private readonly retry: ExponentialBackoffRetry,
    private readonly registry: AdAccountRegistry,
    private readonly events: MetaAdsConnectorEvents,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
    private readonly now: () => Date = () => new Date(),
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
          `datePreset must be one of last_7d|last_14d|last_30d, received: ${input.datePreset}`,
        ),
      );
    }

    this.logger.info(
      { adAccountId: input.adAccountId.toString() },
      "meta-ads-connector: sync starting",
    );

    const rawCampaignsResult = await fetchAllPages<MetaCampaign>((cursor) =>
      callMetaApi(this.rateLimiter, this.retry, () =>
        this.client.getCampaigns(
          input.adAccountId.toString(),
          input.accessToken,
          input.datePreset,
          cursor,
        ),
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
    for (const campaign of campaignsResult.value) {
      const hydratedResult = await this.hydrateCampaign(campaign, input);
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

  private async hydrateCampaign(
    campaign: Campaign,
    input: PullCampaignDataInput,
  ): Promise<Result<Campaign, MetaApiError>> {
    const rawAdSetsResult = await fetchAllPages<MetaAdSet>((cursor) =>
      callMetaApi(this.rateLimiter, this.retry, () =>
        this.client.getAdSets(campaign.metaId, input.accessToken, cursor),
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
    for (const adSet of adSetsResult.value) {
      const hydratedResult = await this.hydrateAdSet(adSet, campaign, input);
      if (!hydratedResult.ok) {
        return hydratedResult;
      }
      hydratedAdSets.push(hydratedResult.value);
    }

    return ok(campaign.withAdSets(hydratedAdSets));
  }

  private async hydrateAdSet(
    adSet: AdSet,
    campaign: Campaign,
    input: PullCampaignDataInput,
  ): Promise<Result<AdSet, MetaApiError>> {
    const rawAdsResult = await fetchAllPages<MetaAd>((cursor) =>
      callMetaApi(this.rateLimiter, this.retry, () =>
        this.client.getAds(adSet.metaId, input.accessToken, input.datePreset, cursor),
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
}

/** Wraps a domain-level mapping failure (e.g. an unrecognized objective/status, a malformed date) as a `MetaApiError` so `execute()` keeps a single error channel — mapping failures are just as "this sync cannot complete" as a transport failure, from the caller's perspective. */
function invalidInputError(message: string): MetaApiError {
  return new MetaApiError(message);
}

import { NotFoundError, ValidationError } from "@aos/errors";
import {
  AdAccountId,
  scoreCreativeDiversity,
  Verdict,
  type AdAccount,
} from "@aos/meta-ads-connector";
import { Inject, Injectable } from "@nestjs/common";

import { META_ADS_CONNECTOR_REGISTRY } from "../../di-tokens.js";
import { ActivityLogger } from "../activity-log/activity-logger.service.js";
import type {
  CampaignInsightRequestDto,
  CampaignInsightResponseDto,
} from "../llm/dto/campaign-insight.dto.js";
import type {
  DiagnoseAdCopyRequestDto,
  DiagnoseAdCopyResponseDto,
} from "../llm/dto/diagnose-ad-copy.dto.js";
import type {
  MetaSettingsRecommendationRequestDto,
  MetaSettingsRecommendationResponseDto,
} from "../llm/dto/meta-settings-recommendation.dto.js";
import { LlmService } from "../llm/llm.service.js";
import { MetaSyncService } from "../meta-sync/meta-sync.service.js";
import { ModeGuardService } from "../mode-guard/mode-guard.service.js";
import { evaluateAndromedaRestructureCandidate } from "../scheduler/domain/andromeda-restructure.js";

import { getAssetDetail } from "./asset-detail.js";
import { getAssetRollup } from "./asset-rollup.js";
import type { AdAccountOptionDto } from "./dto/ad-account-option.dto.js";
import type { AndromedaHealthResponseDto } from "./dto/andromeda-health.dto.js";
import type { AssetDetailResponseDto } from "./dto/asset-detail.dto.js";
import type { AssetRollupResponseDto } from "./dto/asset-rollup.dto.js";
import type { CampaignHistoryResponseDto } from "./dto/campaign-history.dto.js";
import { toAdAccountResponseDto, type AdAccountResponseDto } from "./dto/campaign-response.dto.js";
import type {
  ExecuteVerdictBodyDto,
  ExecuteVerdictResponseDto,
} from "./dto/execute-verdict.dto.js";
import type { HeatmapResponseDto } from "./dto/heatmap.dto.js";
import type { PullCampaignsQueryDto } from "./dto/pull-campaigns.dto.js";
import { getAudienceCreativeHeatmap } from "./heatmap-rollup.js";
import {
  AdTenantIndexRepository,
  indexPulledAdAccount,
} from "./infrastructure/ad-tenant-index.repository.js";
import type { MetaAdsConnectorRegistry } from "./infrastructure/meta-ads-connector-registry.js";

/**
 * Wires `PullCampaignData` and `ExecuteVerdict` from `@aos/meta-ads-connector`, translating
 * between this app's HTTP DTOs and the connector's domain types. Consistent error-translation
 * pattern with `modules/webhook/webhook.service.ts`: on `Result.err(...)`, this service
 * re-throws the raw `@aos/errors` / connector error instance — never a Nest `HttpException` —
 * so `AaosExceptionFilter` is the single place deciding the resulting HTTP status.
 *
 * TENANT-SCOPING FIX (Phase T2, docs/PROMPT-AAOS-META-ADS-TENANT-SCOPING.md): resolves the
 * caller's tenant's own `MetaAdsConnector` (accessToken + ad-account-ids) from
 * `MetaAdsConnectorRegistry` using the real per-request `tenantId` (`@TenantId()`,
 * `common/tenant-context.ts` — same convention `AssetsController`/`AssetsService` already
 * established in Phase T1) — no longer the single, process-wide `config.AAOS_TENANT_ID`.
 * `AAOS_API_CONFIG` is dropped from this service entirely: `AAOS_TENANT_ID` was its only real
 * field ever read here.
 */
@Injectable()
export class MetaAdsService {
  constructor(
    @Inject(META_ADS_CONNECTOR_REGISTRY)
    private readonly connectorRegistry: MetaAdsConnectorRegistry,
    private readonly adTenantIndex: AdTenantIndexRepository,
    private readonly modeGuard: ModeGuardService,
    private readonly activityLogger: ActivityLogger,
    private readonly llmService: LlmService,
    /**
     * EYVRA-META-OAUTH-WHATSAPP-SETUP Sprint 4 — real, best-effort realtime sync hook, wired into
     * `executeVerdict` below (a real campaign/adset/ad UPDATE action). See
     * `MetaSyncService.syncCampaign`'s own doc for why it never throws.
     */
    private readonly metaSync: MetaSyncService,
  ) {}

  async pullCampaigns(
    query: PullCampaignsQueryDto,
    correlationId: string,
    tenantId: string,
  ): Promise<AdAccountResponseDto> {
    const adAccount = await this.pullAdAccount(query, correlationId, tenantId);
    return toAdAccountResponseDto(adAccount);
  }

  /**
   * `GET /api/v1/analytics/assets` — AAOS Analytics Platform Phase 2, "Asset-First Analytics".
   * Natural home is this module (not a new `analytics` module) — it consumes the exact same
   * `AdAccount` pull `pullCampaigns` above already performs, just re-shaped by `getAssetRollup`
   * (pure, testable on its own) instead of `toAdAccountResponseDto`. Deliberately re-pulls fresh
   * from Meta (same as `pullCampaigns`) rather than reading `connector.registry`'s in-memory
   * last-synced snapshot — this endpoint has no independent request contract yet for "give me the
   * last sync, don't re-pull", and a stale silent read would be a worse default than the one real
   * network call `pullCampaigns` itself already pays.
   */
  async getAssetRollup(
    query: PullCampaignsQueryDto,
    correlationId: string,
    tenantId: string,
  ): Promise<AssetRollupResponseDto> {
    const adAccount = await this.pullAdAccount(query, correlationId, tenantId);
    return getAssetRollup(adAccount, new Date());
  }

  /**
   * `GET /api/v1/analytics/heatmap` — AAOS Analytics Platform Phase 3, "Audience × Creative
   * Heatmap". Same real re-pull-fresh-from-Meta approach as `getAssetRollup` above (no independent
   * "give me the last sync" contract on this endpoint either), just reshaped by
   * `getAudienceCreativeHeatmap` instead of `getAssetRollup`.
   */
  async getHeatmap(
    query: PullCampaignsQueryDto,
    correlationId: string,
    tenantId: string,
  ): Promise<HeatmapResponseDto> {
    const adAccount = await this.pullAdAccount(query, correlationId, tenantId);
    return getAudienceCreativeHeatmap(adAccount, new Date());
  }

  /**
   * `GET /api/v1/analytics/assets/:assetId` — AAOS Analytics Platform Phase 4, "Asset detail /
   * Creative Drill-Down". A DEDICATED single-asset endpoint (not `GET /api/v1/analytics/assets
   * ?assetId=`) — a real, deliberate shape decision: the list endpoint's `AssetRollupResponseDto`
   * is an ARRAY of rollup rows, one per asset; this endpoint's `AssetDetailResponseDto` is a
   * SINGLE object with two nested per-asset breakdown tables (`copyVariants`/`audienceBreakdown`)
   * plus a real LLM insight the list endpoint has no equivalent field for — different response
   * shape, not just a narrower filter of the same one, so a distinct route is the honest fit (same
   * "GET /api/v1/analytics/heatmap" vs "assets" precedent: a shared query contract,
   * `adAccountId?`/`datePreset?`, but each its own route because each returns a genuinely
   * different shape).
   *
   * Same real re-pull-fresh-from-Meta approach `getAssetRollup`/`getHeatmap` already use. The real
   * LLM insight call (`LlmService.assetInsight`, in-process, same pattern
   * `SimulationService`/`LocationResolverService` already establish for calling `LlmService`
   * directly rather than a self-HTTP round trip) runs AFTER the pure `getAssetDetail` rollup so its
   * prompt context can be built from that rollup's own already-computed real numbers.
   */
  async getAssetDetail(
    assetId: string,
    query: PullCampaignsQueryDto,
    correlationId: string,
    tenantId: string,
  ): Promise<AssetDetailResponseDto> {
    const adAccount = await this.pullAdAccount(query, correlationId, tenantId);
    const now = new Date();

    // First pass with a synchronous "unavailable" placeholder insight just to confirm the asset is
    // real (never spend an LLM call/rate-limit budget on an assetId that doesn't exist in this
    // pull) — mirrors `checkGate`'s own "no API key" shape so the type lines up without a second,
    // parallel unavailable-DTO builder.
    const probe = getAssetDetail(adAccount, assetId, now, {
      available: false,
      reason: "PROVIDER_ERROR",
      message: "",
    });
    if (probe === undefined) {
      throw new NotFoundError(`No real ad in the current pull carries asset id "${assetId}"`);
    }

    // TENANT-SCOPING FIX (Phase T2): this endpoint now has a real per-request tenant id
    // (`@TenantId()`, threaded in above) — the SAME value is used here for prompt-override
    // resolution, consistent with how this exact service now treats tenancy everywhere else.
    const insight = await this.llmService.assetInsight(tenantId, {
      assetKind: probe.assetKind,
      assetId: probe.assetId,
      adCount: probe.adCount,
      spend: probe.spend,
      totalLead: probe.totalLead,
      cpl: probe.rphLead,
      maxFrequency: probe.maxFrequency,
      audienceBreakdown: probe.audienceBreakdown.map((row) => ({
        audienceLabel: row.audienceLabel,
        adCount: row.adCount,
        spend: row.spend,
        totalLead: row.totalLead,
        cpl: row.cpl,
      })),
      benchmarkCplIDR: null,
    });

    return { ...probe, insight };
  }

  /**
   * `POST /api/v1/campaigns/insight` — AAOS-CAMPAIGNS-UNIFIED-PAGE, the unified `/campaigns`
   * page's `CampaignInsightPanel`. UNLIKE `getAssetDetail`'s in-process `assetInsight` call, this
   * is a dedicated, thin pass-through endpoint: the caller (the dashboard) already has the full
   * campaign→ad-set→ad tree loaded client-side (`AdAccountSummaryDto` from `GET /api/v1/campaigns`,
   * the SAME snapshot `MetricsTab.tsx`/`CampaignTable` already render) and has already aggregated
   * the ONE selected campaign's real metrics itself — re-pulling from Meta here to recompute the
   * exact same numbers server-side would be a second, redundant live Meta call for data the caller
   * already has (the same "don't fetch ulang ke Meta" discipline `CampaignDetailDrawer.tsx`
   * documents). `CampaignInsightRequestSchema`'s Zod validation is the real trust boundary — every
   * field is bounded/typed, so this never blindly forwards arbitrary caller-supplied numbers to the
   * LLM without at least shape validation.
   */
  async getCampaignInsight(
    tenantId: string,
    body: CampaignInsightRequestDto,
  ): Promise<CampaignInsightResponseDto> {
    return this.llmService.campaignInsight(tenantId, body);
  }

  /**
   * `POST /api/v1/campaigns/settings-recommendation` — SAMANTHA META ADS SETTINGS + CREATIVE
   * COPY. Same thin pass-through shape as `getCampaignInsight` above — the caller already has the
   * one selected campaign's real aggregate metrics (and, best-effort, a real `listings` row when a
   * `listingId` is known for it) loaded client-side.
   */
  async getMetaSettingsRecommendation(
    tenantId: string,
    body: MetaSettingsRecommendationRequestDto,
  ): Promise<MetaSettingsRecommendationResponseDto> {
    return this.llmService.metaSettingsRecommendation(tenantId, body);
  }

  /**
   * `GET /api/v1/campaigns/:campaignId/history` — Campaign Page Rebuild v2. `campaignId` is the
   * real, stable Meta campaign id (same convention `getAndromedaHealth` already establishes —
   * never the local, per-pull-regenerated `id`). Thin pass-through to
   * `MetaSyncService.getCampaignHistory`, itself a thin pass-through to the real
   * `meta_insights_daily` read — see that chain's own docs for why this is a plain DB read, not a
   * live Meta pull (the data was already captured by `MetaSyncCronService`'s real sweeps).
   */
  async getCampaignHistory(
    tenantId: string,
    campaignId: string,
    days: number,
  ): Promise<CampaignHistoryResponseDto> {
    const points = await this.metaSync.getCampaignHistory(tenantId, campaignId, days);
    return { campaignId, points };
  }

  /**
   * `POST /api/v1/ads/diagnose-copy` — AAOS Samantha Professional Optimizer, Part C. Same thin
   * pass-through shape as `getCampaignInsight` above: the caller already has the one selected ad's
   * real, already-pulled `primaryText`/`headline`/`description`/`verdict`/metrics/`learningStatus`
   * loaded client-side (from `GET /api/v1/campaigns`'s per-ad tree — see `campaign-response.dto.ts`)
   * and sends them straight through; `DiagnoseAdCopyRequestSchema`'s Zod validation is the real
   * trust boundary, same as `CampaignInsightRequestSchema`'s.
   */
  async getAdCopyDiagnosis(
    tenantId: string,
    body: DiagnoseAdCopyRequestDto,
  ): Promise<DiagnoseAdCopyResponseDto> {
    return this.llmService.diagnoseAdCopy(tenantId, body);
  }

  /**
   * `GET /api/v1/campaigns/:campaignId/andromeda-health` — Samantha Andromeda-Aware Campaign System,
   * Sprint 2. UNLIKE `getCampaignInsight`/`getAdCopyDiagnosis`'s pass-through shape, this is a real,
   * dedicated LIVE-PULL endpoint (same real re-pull-fresh-from-Meta approach `getAssetRollup`/
   * `getHeatmap`/`getAssetDetail` already use): the real diversity signal
   * (`scoreCreativeDiversity`, `@aos/meta-ads-connector`) needs each ad's real `creativeAsset`
   * (`{kind, imageHash|videoId}`), which `campaign-response.dto.ts`'s `AdSummaryDto` deliberately
   * does NOT expose to the frontend (investigated directly — no existing DTO field carries it), so
   * there is nothing honest for a client-side pass-through body to forward. Reuses the exact same
   * `scoreCreativeDiversity`/`evaluateAndromedaRestructureCandidate` pure functions
   * `SchedulerService.runAndromedaRestructureCheck` (Sprint 1) already calls — never a second,
   * parallel diversity computation.
   *
   * Real `NotFoundError` when no campaign in the current pull carries this id — never a fabricated
   * empty health card.
   */
  async getAndromedaHealth(
    campaignId: string,
    query: PullCampaignsQueryDto,
    correlationId: string,
    tenantId: string,
  ): Promise<AndromedaHealthResponseDto> {
    const adAccount = await this.pullAdAccount(query, correlationId, tenantId);
    // Real bug fix (live-confirmed via a 404 in production logs): `campaign.id` is a LOCAL id
    // re-generated randomly by `CampaignMapper` on every single live pull — comparing it against
    // a `campaignId` the caller obtained from an EARLIER, separate pull (this endpoint always does
    // its own fresh `pullAdAccount`, never reuses the caller's) can never match, even for the exact
    // same real Meta campaign. `metaId` is the one real, permanent Meta campaign id — the correct,
    // stable key for a cross-request lookup like this one.
    const campaign = adAccount.campaigns.find((c) => c.metaId === campaignId);
    if (campaign === undefined) {
      throw new NotFoundError(`No real campaign in the current pull carries id "${campaignId}"`);
    }

    const adSetCount = campaign.adSets.length;
    const allAds = campaign.adSets.flatMap((adSet) => adSet.ads);
    const diversity = scoreCreativeDiversity(allAds);
    const evaluation = evaluateAndromedaRestructureCandidate({ adSetCount, diversity });

    return {
      campaignId,
      campaignName: campaign.name,
      adSetCount,
      diversity: {
        status: diversity.status,
        totalAdCount: diversity.totalAdCount,
        ...(diversity.distinctCreativeAssetCount !== undefined
          ? { distinctCreativeAssetCount: diversity.distinctCreativeAssetCount }
          : {}),
        reasoning: diversity.reasoning,
      },
      evaluation: {
        triggered: evaluation.triggered,
        ...(evaluation.reason !== undefined ? { reason: evaluation.reason } : {}),
      },
    };
  }

  private async pullAdAccount(
    query: PullCampaignsQueryDto,
    correlationId: string,
    tenantId: string,
  ): Promise<AdAccount> {
    const connectorResult = await this.connectorRegistry.resolve(tenantId);
    if (!connectorResult.ok) {
      throw connectorResult.error;
    }
    const connector = connectorResult.value;

    const rawAdAccountId = query.adAccountId ?? connector.adAccountIds[0];
    if (rawAdAccountId === undefined) {
      throw new ValidationError(
        "No adAccountId was provided and no default ad account is configured",
      );
    }

    const adAccountIdResult = AdAccountId.create(rawAdAccountId);
    if (!adAccountIdResult.ok) {
      throw adAccountIdResult.error;
    }

    const result = await connector.pullCampaignData.execute({
      adAccountId: adAccountIdResult.value,
      datePreset: query.datePreset,
      accessToken: connector.accessToken,
      tenantId,
      correlationId,
    });
    if (!result.ok) {
      throw result.error;
    }

    // AAOS-MULTI-TENANT-PHASE1C — best-effort, never-throwing index of this pull's real ads, so a
    // later Meta lead webhook can resolve this tenant honestly.
    await indexPulledAdAccount(this.adTenantIndex, tenantId, result.value);

    return result.value;
  }

  /**
   * `GET /api/v1/meta-ads/accounts` — resolves the display `name` for every configured ad
   * account entry, backing the dashboard's multi-account pill selector
   * (`docs/PROMPT-AAOS-DASHBOARD-LEAD-SPEND-CABANG-SOURCE.md` coordinator note #6). Deliberately
   * one lightweight `getAdAccount` call per configured id, never the full `getCampaigns` pull.
   *
   * Judgment call: if Meta's name lookup fails for one particular account (bad token scope, that
   * account temporarily unreachable, etc.), this falls back to using the raw id as the display
   * name for THAT entry rather than failing the whole endpoint — a multi-account dealership
   * losing the selector entirely because one of N accounts had a transient lookup failure would
   * be a worse outcome than showing one pill labelled with its raw id instead of a friendly name.
   * (Contrast with `pullCampaigns` above, which correctly propagates a single hard failure — that
   * call is for one specific account the caller asked for, so there's nothing to gracefully
   * degrade to.)
   */
  async getAdAccounts(tenantId: string): Promise<readonly AdAccountOptionDto[]> {
    const connectorResult = await this.connectorRegistry.resolve(tenantId);
    if (!connectorResult.ok) {
      throw connectorResult.error;
    }
    const connector = connectorResult.value;

    const results = await Promise.all(
      connector.adAccountIds.map(async (id) => {
        const result = await connector.client.getAdAccount(id, connector.accessToken);
        return { id, name: result.ok ? result.value.name : id };
      }),
    );
    return results;
  }

  /**
   * The real Meta-mutating call site `ModeGuardService` gates (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG
   * Phase A point 3 — confirmed via direct read that `scheduler.service.ts`'s handlers are ALL
   * read-only, so this is where the gate genuinely belongs): `connector.executeVerdict.execute`
   * really does pause/scale/fix a live Meta campaign. In DEV mode, `simulateFn` returns an honest
   * `{ action: "SIMULATED", simulated: true, ... }` describing what WOULD have run, never a
   * fabricated real-looking result and never a real Meta API call.
   *
   * AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase B: also the first of the 2 real `ActivityLogger`
   * call sites — one `agent_activities` row per invocation, `mode` taken from
   * `ModeGuardService.resolveMode`'s own real resolution (not guessed), `status` taken from the
   * SAME real outcome `executeOrSimulate` already produced (`result.simulated`).
   */
  async executeVerdict(
    body: ExecuteVerdictBodyDto,
    correlationId: string,
    tenantId: string,
  ): Promise<ExecuteVerdictResponseDto> {
    const connectorResult = await this.connectorRegistry.resolve(tenantId);
    if (!connectorResult.ok) {
      throw connectorResult.error;
    }
    const connector = connectorResult.value;

    const mode = await this.modeGuard.resolveMode(tenantId);
    const activityId = await this.activityLogger.start({
      tenantId,
      agent: "SAMANTHA",
      actionType: "EXECUTE_VERDICT",
      mode,
      loopId: correlationId,
      input: { verdict: body.verdict, targetId: body.targetId, targetType: body.targetType },
    });

    try {
      const result = await this.modeGuard.executeOrSimulate<ExecuteVerdictResponseDto>(
        tenantId,
        async () => {
          const executed = await connector.executeVerdict.execute({
            verdict: Verdict[body.verdict],
            targetId: body.targetId,
            targetType: body.targetType,
            accessToken: connector.accessToken,
            tenantId,
            correlationId,
          });
          if (!executed.ok) {
            throw executed.error;
          }
          return { ...executed.value, simulated: false };
        },
        () =>
          Promise.resolve({
            action: "SIMULATED",
            targetId: body.targetId,
            targetType: body.targetType,
            simulated: true,
          }),
      );

      await this.activityLogger.complete(activityId, {
        status: result.simulated ? "SIMULATED" : "SUCCESS",
        ...(result.simulated ? { devPreview: result } : { output: result }),
      });

      // EYVRA-META-OAUTH-WHATSAPP-SETUP Sprint 4 — real, best-effort, non-blocking realtime sync.
      // Only when the verdict actually targeted the CAMPAIGN node directly (`body.targetId` is
      // then a real Meta campaign id `MetaSyncService.syncCampaign` can use as-is) and it was a
      // real LIVE action (never fired for a DEV `simulated` result — nothing real changed on
      // Meta). An `adset`/`ad`-targeted verdict is intentionally NOT hooked here — resolving a
      // real campaign id from an adset/ad id would need a further lookup this sprint's honest
      // scope doesn't add; the next 15-minute cron sweep picks up any such change instead.
      if (!result.simulated && body.targetType === "campaign") {
        void this.metaSync.syncCampaign(tenantId, body.targetId);
      }

      return result;
    } catch (error) {
      await this.activityLogger.fail(activityId, error);
      throw error;
    }
  }
}

import { ValidationError } from "@aos/errors";
import { AdAccountId, Verdict, type AdAccount } from "@aos/meta-ads-connector";
import { Inject, Injectable } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG, META_ADS_CONNECTOR_REGISTRY } from "../../di-tokens.js";
import { ActivityLogger } from "../activity-log/activity-logger.service.js";
import { ModeGuardService } from "../mode-guard/mode-guard.service.js";

import { getAssetRollup } from "./asset-rollup.js";
import type { AdAccountOptionDto } from "./dto/ad-account-option.dto.js";
import type { AssetRollupResponseDto } from "./dto/asset-rollup.dto.js";
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
 * AAOS-MULTI-TENANT-PHASE1B (Phase 3): resolves the caller's tenant's own `MetaAdsConnector`
 * (accessToken + ad-account-ids) from `MetaAdsConnectorRegistry` rather than the single static
 * connector — `config.AAOS_TENANT_ID` today (no per-request tenant context on this endpoint yet),
 * same static-default approach every other converted consumer in this phase uses.
 */
@Injectable()
export class MetaAdsService {
  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(META_ADS_CONNECTOR_REGISTRY)
    private readonly connectorRegistry: MetaAdsConnectorRegistry,
    private readonly adTenantIndex: AdTenantIndexRepository,
    private readonly modeGuard: ModeGuardService,
    private readonly activityLogger: ActivityLogger,
  ) {}

  async pullCampaigns(
    query: PullCampaignsQueryDto,
    correlationId: string,
  ): Promise<AdAccountResponseDto> {
    const adAccount = await this.pullAdAccount(query, correlationId);
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
  ): Promise<AssetRollupResponseDto> {
    const adAccount = await this.pullAdAccount(query, correlationId);
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
  ): Promise<HeatmapResponseDto> {
    const adAccount = await this.pullAdAccount(query, correlationId);
    return getAudienceCreativeHeatmap(adAccount, new Date());
  }

  private async pullAdAccount(
    query: PullCampaignsQueryDto,
    correlationId: string,
  ): Promise<AdAccount> {
    const connectorResult = await this.connectorRegistry.resolve(this.config.AAOS_TENANT_ID);
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
      tenantId: this.config.AAOS_TENANT_ID,
      correlationId,
    });
    if (!result.ok) {
      throw result.error;
    }

    // AAOS-MULTI-TENANT-PHASE1C — best-effort, never-throwing index of this pull's real ads, so a
    // later Meta lead webhook can resolve this tenant honestly.
    await indexPulledAdAccount(this.adTenantIndex, this.config.AAOS_TENANT_ID, result.value);

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
  async getAdAccounts(): Promise<readonly AdAccountOptionDto[]> {
    const connectorResult = await this.connectorRegistry.resolve(this.config.AAOS_TENANT_ID);
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
  ): Promise<ExecuteVerdictResponseDto> {
    const connectorResult = await this.connectorRegistry.resolve(this.config.AAOS_TENANT_ID);
    if (!connectorResult.ok) {
      throw connectorResult.error;
    }
    const connector = connectorResult.value;

    const mode = await this.modeGuard.resolveMode(this.config.AAOS_TENANT_ID);
    const activityId = await this.activityLogger.start({
      tenantId: this.config.AAOS_TENANT_ID,
      agent: "SAMANTHA",
      actionType: "EXECUTE_VERDICT",
      mode,
      loopId: correlationId,
      input: { verdict: body.verdict, targetId: body.targetId, targetType: body.targetType },
    });

    try {
      const result = await this.modeGuard.executeOrSimulate<ExecuteVerdictResponseDto>(
        this.config.AAOS_TENANT_ID,
        async () => {
          const executed = await connector.executeVerdict.execute({
            verdict: Verdict[body.verdict],
            targetId: body.targetId,
            targetType: body.targetType,
            accessToken: connector.accessToken,
            tenantId: this.config.AAOS_TENANT_ID,
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
      return result;
    } catch (error) {
      await this.activityLogger.fail(activityId, error);
      throw error;
    }
  }
}

import { ValidationError } from "@aos/errors";
import type { ExecutionResult } from "@aos/meta-ads-connector";
import { AdAccountId, Verdict } from "@aos/meta-ads-connector";
import { Inject, Injectable } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG, META_ADS_CONNECTOR_REGISTRY } from "../../di-tokens.js";

import type { AdAccountOptionDto } from "./dto/ad-account-option.dto.js";
import { toAdAccountResponseDto, type AdAccountResponseDto } from "./dto/campaign-response.dto.js";
import type { ExecuteVerdictBodyDto } from "./dto/execute-verdict.dto.js";
import type { PullCampaignsQueryDto } from "./dto/pull-campaigns.dto.js";
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
  ) {}

  async pullCampaigns(
    query: PullCampaignsQueryDto,
    correlationId: string,
  ): Promise<AdAccountResponseDto> {
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

    return toAdAccountResponseDto(result.value);
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

  async executeVerdict(
    body: ExecuteVerdictBodyDto,
    correlationId: string,
  ): Promise<ExecutionResult> {
    const connectorResult = await this.connectorRegistry.resolve(this.config.AAOS_TENANT_ID);
    if (!connectorResult.ok) {
      throw connectorResult.error;
    }
    const connector = connectorResult.value;

    const result = await connector.executeVerdict.execute({
      verdict: Verdict[body.verdict],
      targetId: body.targetId,
      targetType: body.targetType,
      accessToken: connector.accessToken,
      tenantId: this.config.AAOS_TENANT_ID,
      correlationId,
    });
    if (!result.ok) {
      throw result.error;
    }

    return result.value;
  }
}

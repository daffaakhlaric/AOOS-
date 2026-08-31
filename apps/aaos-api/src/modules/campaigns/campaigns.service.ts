import { AdAccountId } from "@aos/meta-ads-connector";
import { Inject, Injectable } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG, META_ADS_CONNECTOR_REGISTRY } from "../../di-tokens.js";
import type { MetaAdsConnectorRegistry } from "../meta-ads/infrastructure/meta-ads-connector-registry.js";
import { ModeGuardService } from "../mode-guard/mode-guard.service.js";

import type {
  CreateCampaignBodyDto,
  CreateCampaignResponseDto,
} from "./dto/create-campaign.dto.js";

/**
 * Wires `CreateCampaign` from `@aos/meta-ads-connector` (AAOS-W1D-S3 Fix 3), translating between
 * this app's HTTP DTO and the connector's domain types — same composition/error-translation
 * pattern as `modules/meta-ads/meta-ads.service.ts` (re-throws the raw `@aos/errors`/connector
 * error instance on `Result.err(...)`, never a Nest `HttpException`, so `AaosExceptionFilter` is
 * the single place deciding the resulting HTTP status).
 *
 * AAOS-MULTI-TENANT-PHASE1B (Phase 3): resolves the caller's tenant's own `MetaAdsConnector`
 * (accessToken + ad-account-ids) from `MetaAdsConnectorRegistry` rather than the single static
 * connector — `config.AAOS_TENANT_ID` today (this app has no per-request tenant context on this
 * endpoint yet), same "static default until request-scoped tenant exists" approach every other
 * converted consumer in this phase uses. `ConnectorNotConfiguredError` is re-thrown as-is
 * (`AaosExceptionFilter` already maps it to a real HTTP status via its `UnavailableError` base).
 */
@Injectable()
export class CampaignsService {
  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(META_ADS_CONNECTOR_REGISTRY)
    private readonly connectorRegistry: MetaAdsConnectorRegistry,
    private readonly modeGuard: ModeGuardService,
  ) {}

  /**
   * The other real Meta-mutating call site `ModeGuardService` gates (AAOS-PROPERTY-DEVLIVE-
   * ACTIVITYLOG Phase A point 3): `connector.createCampaign.execute` really creates a (PAUSED)
   * campaign+adset on Meta. DEV mode's `simulateFn` never touches Meta and returns an honest
   * `{ simulated: true }` with no ids — see `CreateCampaignResponseDto`'s doc for why fabricating
   * ids would be worse.
   */
  async createCampaign(
    body: CreateCampaignBodyDto,
    correlationId: string,
  ): Promise<CreateCampaignResponseDto> {
    const adAccountIdResult = AdAccountId.create(body.adAccountId);
    if (!adAccountIdResult.ok) {
      throw adAccountIdResult.error;
    }

    const connectorResult = await this.connectorRegistry.resolve(this.config.AAOS_TENANT_ID);
    if (!connectorResult.ok) {
      throw connectorResult.error;
    }
    const connector = connectorResult.value;

    return this.modeGuard.executeOrSimulate<CreateCampaignResponseDto>(
      this.config.AAOS_TENANT_ID,
      async () => {
        const result = await connector.createCampaign.execute({
          adAccountId: adAccountIdResult.value,
          name: body.name,
          branch: body.branch,
          funnel: body.funnel,
          accessToken: connector.accessToken,
          tenantId: this.config.AAOS_TENANT_ID,
          correlationId,
          dailyBudgetIDR: body.dailyBudgetIDR,
        });
        if (!result.ok) {
          throw result.error;
        }
        return { ...result.value, simulated: false };
      },
      () => Promise.resolve({ simulated: true }),
    );
  }
}

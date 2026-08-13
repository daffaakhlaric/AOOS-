import type { MetaAdsConnector } from "@aos/meta-ads-connector";
import { AdAccountId } from "@aos/meta-ads-connector";
import { Inject, Injectable } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG, META_ADS_CONNECTOR } from "../../di-tokens.js";

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
 */
@Injectable()
export class CampaignsService {
  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(META_ADS_CONNECTOR) private readonly connector: MetaAdsConnector,
  ) {}

  async createCampaign(
    body: CreateCampaignBodyDto,
    correlationId: string,
  ): Promise<CreateCampaignResponseDto> {
    const adAccountIdResult = AdAccountId.create(body.adAccountId);
    if (!adAccountIdResult.ok) {
      throw adAccountIdResult.error;
    }

    const result = await this.connector.createCampaign.execute({
      adAccountId: adAccountIdResult.value,
      name: body.name,
      branch: body.branch,
      funnel: body.funnel,
      accessToken: this.config.META_ACCESS_TOKEN,
      tenantId: this.config.AAOS_TENANT_ID,
      correlationId,
      dailyBudgetIDR: body.dailyBudgetIDR,
    });
    if (!result.ok) {
      throw result.error;
    }

    return result.value;
  }
}

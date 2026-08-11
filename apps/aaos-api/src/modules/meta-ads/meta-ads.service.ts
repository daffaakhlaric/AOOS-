import { ValidationError } from "@aos/errors";
import type { ExecutionResult, MetaAdsConnector } from "@aos/meta-ads-connector";
import { AdAccountId, Verdict } from "@aos/meta-ads-connector";
import { Inject, Injectable } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG, META_ADS_CONNECTOR } from "../../di-tokens.js";

import { toAdAccountResponseDto, type AdAccountResponseDto } from "./dto/campaign-response.dto.js";
import type { ExecuteVerdictBodyDto } from "./dto/execute-verdict.dto.js";
import type { PullCampaignsQueryDto } from "./dto/pull-campaigns.dto.js";

/**
 * Wires `PullCampaignData` and `ExecuteVerdict` from `@aos/meta-ads-connector`, translating
 * between this app's HTTP DTOs and the connector's domain types. Consistent error-translation
 * pattern with `modules/webhook/webhook.service.ts`: on `Result.err(...)`, this service
 * re-throws the raw `@aos/errors` / connector error instance — never a Nest `HttpException` —
 * so `AaosExceptionFilter` is the single place deciding the resulting HTTP status.
 */
@Injectable()
export class MetaAdsService {
  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(META_ADS_CONNECTOR) private readonly connector: MetaAdsConnector,
  ) {}

  async pullCampaigns(
    query: PullCampaignsQueryDto,
    correlationId: string,
  ): Promise<AdAccountResponseDto> {
    const rawAdAccountId = query.adAccountId ?? this.config.META_AD_ACCOUNT_IDS[0];
    if (rawAdAccountId === undefined) {
      throw new ValidationError(
        "No adAccountId was provided and no default ad account is configured",
      );
    }

    const adAccountIdResult = AdAccountId.create(rawAdAccountId);
    if (!adAccountIdResult.ok) {
      throw adAccountIdResult.error;
    }

    const result = await this.connector.pullCampaignData.execute({
      adAccountId: adAccountIdResult.value,
      datePreset: query.datePreset,
      accessToken: this.config.META_ACCESS_TOKEN,
      tenantId: this.config.AAOS_TENANT_ID,
      correlationId,
    });
    if (!result.ok) {
      throw result.error;
    }

    return toAdAccountResponseDto(result.value);
  }

  async executeVerdict(
    body: ExecuteVerdictBodyDto,
    correlationId: string,
  ): Promise<ExecutionResult> {
    const result = await this.connector.executeVerdict.execute({
      verdict: Verdict[body.verdict],
      targetId: body.targetId,
      targetType: body.targetType,
      accessToken: this.config.META_ACCESS_TOKEN,
      tenantId: this.config.AAOS_TENANT_ID,
      correlationId,
    });
    if (!result.ok) {
      throw result.error;
    }

    return result.value;
  }
}

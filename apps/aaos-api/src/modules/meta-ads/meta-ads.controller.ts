import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from "@nestjs/common";

import { CorrelationId } from "../../common/correlation.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";

import type { AdAccountOptionDto } from "./dto/ad-account-option.dto.js";
import type { AssetRollupResponseDto } from "./dto/asset-rollup.dto.js";
import type { AdAccountResponseDto } from "./dto/campaign-response.dto.js";
import {
  ExecuteVerdictBodySchema,
  type ExecuteVerdictBodyDto,
  type ExecuteVerdictResponseDto,
} from "./dto/execute-verdict.dto.js";
import { PullCampaignsQuerySchema, type PullCampaignsQueryDto } from "./dto/pull-campaigns.dto.js";
import { ApiKeyGuard } from "./guards/api-key.guard.js";
import { MetaAdsService } from "./meta-ads.service.js";

/** `GET /api/v1/campaigns`, `POST /api/v1/verdicts` — both require `x-api-key` auth. */
@Controller("api/v1")
@UseGuards(ApiKeyGuard)
export class MetaAdsController {
  constructor(private readonly metaAdsService: MetaAdsService) {}

  @Get("campaigns")
  async getCampaigns(
    @Query(new ZodValidationPipe(PullCampaignsQuerySchema)) query: PullCampaignsQueryDto,
    @CorrelationId() correlationId: string,
  ): Promise<AdAccountResponseDto> {
    return this.metaAdsService.pullCampaigns(query, correlationId);
  }

  /**
   * `GET /api/v1/meta-ads/accounts` — the configured ad accounts (id + resolved display name),
   * backing the dashboard's multi-account pill selector (coordinator note #6 on
   * `docs/PROMPT-AAOS-DASHBOARD-LEAD-SPEND-CABANG-SOURCE.md`). Always returns at least 1 entry
   * (parseAaosApiConfig requires `META_AD_ACCOUNT_IDS` to be non-empty) — the dashboard only
   * needs to render the "Semua Akun" pill when this array has more than 1 element.
   */
  @Get("meta-ads/accounts")
  async getAdAccounts(): Promise<readonly AdAccountOptionDto[]> {
    return this.metaAdsService.getAdAccounts();
  }

  /**
   * `GET /api/v1/analytics/assets` — AAOS Analytics Platform Phase 2, "Asset-First Analytics".
   * Same query contract as `GET /api/v1/campaigns` (`adAccountId?`, `datePreset?`) since it pulls
   * the identical underlying `AdAccount` tree, just rolled up by creative asset id instead of
   * returned as the raw campaign hierarchy.
   */
  @Get("analytics/assets")
  async getAssetRollup(
    @Query(new ZodValidationPipe(PullCampaignsQuerySchema)) query: PullCampaignsQueryDto,
    @CorrelationId() correlationId: string,
  ): Promise<AssetRollupResponseDto> {
    return this.metaAdsService.getAssetRollup(query, correlationId);
  }

  @Post("verdicts")
  @HttpCode(200)
  async postVerdict(
    @Body(new ZodValidationPipe(ExecuteVerdictBodySchema)) body: ExecuteVerdictBodyDto,
    @CorrelationId() correlationId: string,
  ): Promise<ExecuteVerdictResponseDto> {
    return this.metaAdsService.executeVerdict(body, correlationId);
  }
}

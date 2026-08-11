import type { ExecutionResult } from "@aos/meta-ads-connector";
import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from "@nestjs/common";

import { CorrelationId } from "../../common/correlation.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";

import type { AdAccountResponseDto } from "./dto/campaign-response.dto.js";
import { ExecuteVerdictBodySchema, type ExecuteVerdictBodyDto } from "./dto/execute-verdict.dto.js";
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

  @Post("verdicts")
  @HttpCode(200)
  async postVerdict(
    @Body(new ZodValidationPipe(ExecuteVerdictBodySchema)) body: ExecuteVerdictBodyDto,
    @CorrelationId() correlationId: string,
  ): Promise<ExecutionResult> {
    return this.metaAdsService.executeVerdict(body, correlationId);
  }
}

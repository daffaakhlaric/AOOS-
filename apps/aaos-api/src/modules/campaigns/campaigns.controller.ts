import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";

import { CorrelationId } from "../../common/correlation.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { CampaignsService } from "./campaigns.service.js";
import {
  CreateCampaignBodySchema,
  type CreateCampaignBodyDto,
  type CreateCampaignResponseDto,
} from "./dto/create-campaign.dto.js";

/** `POST /api/v1/campaigns/create` (AAOS-W1D-S3 Fix 3) — requires `x-api-key` auth, same guard as `/api/v1/campaigns`/`/api/v1/verdicts`. */
@Controller("api/v1/campaigns")
@UseGuards(ApiKeyGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post("create")
  @HttpCode(200)
  async createCampaign(
    @Body(new ZodValidationPipe(CreateCampaignBodySchema)) body: CreateCampaignBodyDto,
    @CorrelationId() correlationId: string,
  ): Promise<CreateCampaignResponseDto> {
    return this.campaignsService.createCampaign(body, correlationId);
  }
}

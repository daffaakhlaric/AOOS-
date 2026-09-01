import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";

import { CorrelationId } from "../../common/correlation.js";
import { TenantId } from "../../common/tenant-context.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { CampaignsService } from "./campaigns.service.js";
import {
  CreateCampaignBodySchema,
  type CreateCampaignBodyDto,
  type CreateCampaignResponseDto,
} from "./dto/create-campaign.dto.js";
import {
  CreatePropertyCampaignBodySchema,
  type CreatePropertyCampaignBodyDto,
  type CreatePropertyCampaignResponseDto,
} from "./dto/create-property-campaign.dto.js";

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

  /**
   * `POST /api/v1/campaigns/property` (AAOS EPIC S, Phase S4) — real PROPERTY campaign creation
   * from a real `listings` row, genuinely separate from `create` (see
   * `create-property-campaign.dto.ts`'s own docstring for why). Tenant-scoped via `@TenantId()`
   * from day one — `modules/listings`'/`modules/creative-packages`'s (K1) own established
   * convention for every new endpoint this session adds, unlike the pre-existing `create` endpoint
   * above (which still reads the static `AAOS_API_CONFIG.AAOS_TENANT_ID` — a real, pre-existing
   * gap this phase does not fix, matching K1's own precedent of leaving pre-existing AUTOMOTIVE
   * endpoints untouched).
   */
  @Post("property")
  @HttpCode(200)
  async createPropertyCampaign(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(CreatePropertyCampaignBodySchema))
    body: CreatePropertyCampaignBodyDto,
    @CorrelationId() correlationId: string,
  ): Promise<CreatePropertyCampaignResponseDto> {
    return this.campaignsService.createPropertyCampaign(tenantId, body, correlationId);
  }
}

import { Controller, Get, Param, UseGuards } from "@nestjs/common";

import { TenantId } from "../../common/tenant-context.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { CampaignCreationService } from "./campaign-creation.service.js";
import type {
  CampaignBlueprintResponseDto,
  CampaignPreflightResponseDto,
  ListingReadinessResponseDto,
} from "./dto/campaign-creation.dto.js";

/**
 * `GET /api/v1/campaign-creation/...` — EYVRA SAMANTHA V2 Phase 25 (PROMPT 32/33/35). `x-api-key`
 * auth (same perimeter as every other `aaos-api` module), tenant-scoped via `@TenantId()`.
 *
 * All three routes are read-only planning/assessment — 100% GET, zero mutation, zero Meta API call.
 * PROMPT 36 (Safe Campaign Creation, the real Meta mutation) is explicitly out of scope for this
 * phase and would be its own `POST` route in a future, separately-reviewed phase.
 */
@Controller("api/v1/campaign-creation")
@UseGuards(ApiKeyGuard)
export class CampaignCreationController {
  constructor(private readonly service: CampaignCreationService) {}

  @Get("listings/:listingId/readiness")
  async listingReadiness(
    @TenantId() tenantId: string,
    @Param("listingId") listingId: string,
  ): Promise<ListingReadinessResponseDto> {
    return this.service.getListingReadiness(tenantId, listingId);
  }

  @Get("growth-objectives/:growthObjectiveId/listings/:listingId/blueprint")
  async blueprint(
    @TenantId() tenantId: string,
    @Param("growthObjectiveId") growthObjectiveId: string,
    @Param("listingId") listingId: string,
  ): Promise<CampaignBlueprintResponseDto> {
    return this.service.getBlueprint(tenantId, growthObjectiveId, listingId);
  }

  @Get("growth-objectives/:growthObjectiveId/listings/:listingId/preflight")
  async preflight(
    @TenantId() tenantId: string,
    @Param("growthObjectiveId") growthObjectiveId: string,
    @Param("listingId") listingId: string,
  ): Promise<CampaignPreflightResponseDto> {
    return this.service.getPreflight(tenantId, growthObjectiveId, listingId);
  }
}

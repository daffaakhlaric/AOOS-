import { Controller, Get, Param, UseGuards } from "@nestjs/common";

import { TenantId } from "../../common/tenant-context.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import type { OpportunitiesResponseDto } from "./dto/opportunities-response.dto.js";
import { OpportunitiesService } from "./opportunities.service.js";

/**
 * `GET /api/v1/opportunities/:campaignId` — `x-api-key` auth (same perimeter as every other
 * `aaos-api` module), tenant-scoped via `@TenantId()`. `campaignId` is the real `meta_campaign_id`,
 * matching this app's existing `campaign-health/:campaignId`/`metric-snapshots/campaign/:campaignId`
 * path convention.
 */
@Controller("api/v1/opportunities")
@UseGuards(ApiKeyGuard)
export class OpportunitiesController {
  constructor(private readonly service: OpportunitiesService) {}

  @Get(":campaignId")
  async detect(
    @TenantId() tenantId: string,
    @Param("campaignId") campaignId: string,
  ): Promise<OpportunitiesResponseDto> {
    return this.service.detect(tenantId, campaignId);
  }
}

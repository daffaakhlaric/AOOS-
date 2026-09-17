import { Controller, Get, Param, UseGuards } from "@nestjs/common";

import { TenantId } from "../../common/tenant-context.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { CampaignHealthService } from "./campaign-health.service.js";
import type { CampaignHealthResponseDto } from "./dto/campaign-health-response.dto.js";

/**
 * `GET /api/v1/campaign-health/:campaignId` — `x-api-key` auth (same perimeter as every other
 * `aaos-api` module), tenant-scoped via `@TenantId()`. `campaignId` is the real `meta_campaign_id`,
 * matching this app's existing `campaigns/:campaignId/history`/`metric-snapshots/campaign/:campaignId`
 * path convention.
 */
@Controller("api/v1/campaign-health")
@UseGuards(ApiKeyGuard)
export class CampaignHealthController {
  constructor(private readonly service: CampaignHealthService) {}

  @Get(":campaignId")
  async assess(
    @TenantId() tenantId: string,
    @Param("campaignId") campaignId: string,
  ): Promise<CampaignHealthResponseDto> {
    return this.service.assess(tenantId, campaignId);
  }
}

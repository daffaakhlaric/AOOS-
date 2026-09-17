import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";

import { TenantId } from "../../common/tenant-context.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import {
  MetricSnapshotQuerySchema,
  type CampaignMetricSnapshotResponseDto,
  type MetricSnapshotDto,
  type MetricSnapshotQueryDto,
} from "./dto/metric-snapshot.dto.js";
import { MetricSnapshotService } from "./metric-snapshot.service.js";

/**
 * `GET /api/v1/metric-snapshots/campaign/:campaignId`, `GET /api/v1/metric-snapshots/account` —
 * `x-api-key` auth (same perimeter as every other `aaos-api` module), tenant-scoped via
 * `@TenantId()`. `campaignId` is the real `meta_campaign_id`, matching this app's existing
 * `campaigns/:campaignId/history`/`andromeda-health`/`listing-id` path convention
 * (`meta-ads.controller.ts`).
 */
@Controller("api/v1/metric-snapshots")
@UseGuards(ApiKeyGuard)
export class MetricSnapshotController {
  constructor(private readonly service: MetricSnapshotService) {}

  @Get("campaign/:campaignId")
  async campaign(
    @TenantId() tenantId: string,
    @Param("campaignId") campaignId: string,
    @Query(new ZodValidationPipe(MetricSnapshotQuerySchema)) query: MetricSnapshotQueryDto,
  ): Promise<CampaignMetricSnapshotResponseDto> {
    const snapshot = await this.service.getCampaignSnapshot(tenantId, campaignId, query.window);
    return { campaignId, ...snapshot };
  }

  @Get("account")
  async account(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(MetricSnapshotQuerySchema)) query: MetricSnapshotQueryDto,
  ): Promise<MetricSnapshotDto> {
    return this.service.getAccountSnapshot(tenantId, query.window);
  }
}

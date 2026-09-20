import { Controller, Get, Query, UseGuards } from "@nestjs/common";

import { CorrelationId } from "../../common/correlation.js";
import { TenantId } from "../../common/tenant-context.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import type { OverviewResponseDto } from "./dto/overview-response.dto.js";
import {
  OverviewTimeseriesQuerySchema,
  type OverviewTimeseriesQueryDto,
  type OverviewTimeseriesResponseDto,
} from "./dto/overview-timeseries.dto.js";
import { OverviewService } from "./overview.service.js";

/**
 * `GET /api/v1/overview` — AAOS Overview Monitor Phase O1's one real aggregate endpoint,
 * `@TenantId()`-scoped from day one (every module this session has touched establishes this
 * convention — `ActivityLogController`/`LeadsController`, etc.). `x-api-key` auth, same perimeter
 * as every other `aaos-api` module. Phase O2 (the actual dashboard page) is separate, later.
 */
@Controller("api/v1/overview")
@UseGuards(ApiKeyGuard)
export class OverviewController {
  constructor(private readonly overviewService: OverviewService) {}

  @Get()
  async getOverview(
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
  ): Promise<OverviewResponseDto> {
    return this.overviewService.getOverview(tenantId, correlationId);
  }

  /**
   * `GET /api/v1/overview/timeseries` — Command Center "Performance Overview" chart (EYVRA
   * SAMANTHA V2 + KAI V2 Phase 56). Real, already-persisted `overview_daily_snapshots` rows for
   * this tenant (`OverviewSnapshotCronService`'s daily sweep), never a live Meta pull — see
   * `OverviewService.getTimeseries`'s own doc.
   */
  @Get("timeseries")
  async getTimeseries(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(OverviewTimeseriesQuerySchema)) query: OverviewTimeseriesQueryDto,
  ): Promise<OverviewTimeseriesResponseDto> {
    return this.overviewService.getTimeseries(tenantId, query.days);
  }
}

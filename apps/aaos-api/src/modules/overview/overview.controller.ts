import { Controller, Get, UseGuards } from "@nestjs/common";

import { CorrelationId } from "../../common/correlation.js";
import { TenantId } from "../../common/tenant-context.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import type { OverviewResponseDto } from "./dto/overview-response.dto.js";
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
}

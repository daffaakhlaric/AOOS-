import { Controller, Get, Query, UseGuards } from "@nestjs/common";

import { TenantId } from "../../common/tenant-context.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { CreativeMemoryService } from "./creative-memory.service.js";
import {
  AnglePerformanceQuerySchema,
  type AnglePerformanceQueryDto,
  type AnglePerformanceResponseDto,
} from "./dto/angle-performance.dto.js";
import {
  AssetPerformanceQuerySchema,
  type AssetPerformanceQueryDto,
  type AssetPerformanceResponseDto,
} from "./dto/asset-performance.dto.js";

/**
 * `GET /api/v1/creative-memory/angle-performance` — `x-api-key` auth (same perimeter as every
 * other `aaos-api` module), tenant-scoped via `@TenantId()`. Optional `?since=YYYY-MM-DD&
 * until=YYYY-MM-DD`, both together (lifetime when omitted) — see
 * `dto/angle-performance.dto.ts`'s own doc for why a lone `since`/`until` is rejected rather than
 * silently reinterpreted.
 */
@Controller("api/v1/creative-memory")
@UseGuards(ApiKeyGuard)
export class CreativeMemoryController {
  constructor(private readonly service: CreativeMemoryService) {}

  @Get("angle-performance")
  async anglePerformance(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(AnglePerformanceQuerySchema)) query: AnglePerformanceQueryDto,
  ): Promise<AnglePerformanceResponseDto> {
    const window =
      query.since !== undefined && query.until !== undefined
        ? { start: query.since, end: query.until }
        : undefined;
    return this.service.getAnglePerformance(tenantId, window);
  }

  /**
   * Kai V2 Asset Analyzer (Phase 21) — `GET /api/v1/creative-memory/asset-performance`. Same
   * `x-api-key` auth, same tenant scoping via `@TenantId()`, same optional `?since=&until=` window
   * discipline as `anglePerformance` above — one `AssetPerformanceResult` per real, individually
   * published creative asset (never grouped by angle).
   */
  @Get("asset-performance")
  async assetPerformance(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(AssetPerformanceQuerySchema)) query: AssetPerformanceQueryDto,
  ): Promise<AssetPerformanceResponseDto> {
    const window =
      query.since !== undefined && query.until !== undefined
        ? { start: query.since, end: query.until }
        : undefined;
    return this.service.getAssetPerformance(tenantId, window);
  }
}

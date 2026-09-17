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
}

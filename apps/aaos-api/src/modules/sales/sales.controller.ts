import { Controller, Get, Query, UseGuards } from "@nestjs/common";

import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { GetSalesStatsQuerySchema, type GetSalesStatsQueryDto } from "./dto/get-sales-stats.dto.js";
import type { SalesStatsResponseDto } from "./dto/sales-stats-response.dto.js";
import { SalesService } from "./sales.service.js";

/** `GET /api/v1/sales/stats` — `x-api-key` auth (mirrors `LeadsController`'s auth discipline). */
@Controller("api/v1/sales")
@UseGuards(ApiKeyGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get("stats")
  async getStats(
    @Query(new ZodValidationPipe(GetSalesStatsQuerySchema)) query: GetSalesStatsQueryDto,
  ): Promise<SalesStatsResponseDto> {
    return this.salesService.getStats(query);
  }
}

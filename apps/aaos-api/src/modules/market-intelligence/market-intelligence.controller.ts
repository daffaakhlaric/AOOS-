import { NotFoundError } from "@aos/errors";
import { Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import type { MarketSignalsResponseDto } from "./dto/market-signals.dto.js";
import { MarketIntelligenceService } from "./market-intelligence.service.js";

/**
 * `/api/v1/market-signals*` — `x-api-key` auth, same discipline as every other write endpoint in
 * this app (AAOS LOOP UPGRADE, Sprint 7 Prompt 18). Not `@TenantId()`-scoped — same real
 * single-tenant-composition convention `IntelligenceController` already establishes (see
 * `MarketIntelligenceService`'s own doc).
 */
@Controller("api/v1/market-signals")
@UseGuards(ApiKeyGuard)
export class MarketIntelligenceController {
  constructor(private readonly service: MarketIntelligenceService) {}

  /** `GET /api/v1/market-signals/latest` — the latest real persisted signal row for this tenant. */
  @Get("latest")
  async getLatest(): Promise<MarketSignalsResponseDto> {
    const latest = await this.service.getLatest();
    if (latest === undefined) {
      throw new NotFoundError("Belum ada Market Intelligence run untuk tenant ini.");
    }
    return latest;
  }

  /** `POST /api/v1/market-signals/refresh` — runs the full real aggregation synchronously and returns the fresh result. */
  @Post("refresh")
  @HttpCode(200)
  async refresh(): Promise<MarketSignalsResponseDto> {
    return this.service.refresh();
  }
}

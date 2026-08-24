import { NotFoundError } from "@aos/errors";
import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";

import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import {
  CreateCompetitorPageBodySchema,
  toCompetitorPageResponseDto,
  type CompetitorPageResponseDto,
  type CreateCompetitorPageBodyDto,
  type IntelligenceSignalsResponseDto,
} from "./dto/intelligence.dto.js";
import { IntelligenceService } from "./intelligence.service.js";

/**
 * `/api/v1/intelligence*` + `/api/v1/competitors*` — `x-api-key` auth, same discipline as every
 * other write endpoint in this app (AAOS-TAMARA-INTELLIGENCE-LAYER Phase 4).
 */
@Controller("api/v1")
@UseGuards(ApiKeyGuard)
export class IntelligenceController {
  constructor(private readonly service: IntelligenceService) {}

  /** `GET /api/v1/intelligence/signals` — the latest real persisted signal row for this tenant. */
  @Get("intelligence/signals")
  async getSignals(): Promise<IntelligenceSignalsResponseDto> {
    const latest = await this.service.getLatest();
    if (latest === undefined) {
      throw new NotFoundError("Belum ada Tamara Intelligence run untuk tenant ini.");
    }
    return latest;
  }

  /** `POST /api/v1/intelligence/refresh` — runs the full real aggregation + synthesis synchronously and returns the fresh result. */
  @Post("intelligence/refresh")
  @HttpCode(200)
  async refresh(): Promise<IntelligenceSignalsResponseDto> {
    return this.service.refresh();
  }

  /** `GET /api/v1/competitors`. */
  @Get("competitors")
  async listCompetitors(): Promise<readonly CompetitorPageResponseDto[]> {
    const rows = await this.service.listCompetitorPages();
    return rows.map(toCompetitorPageResponseDto);
  }

  /** `POST /api/v1/competitors`. */
  @Post("competitors")
  @HttpCode(201)
  async createCompetitor(
    @Body(new ZodValidationPipe(CreateCompetitorPageBodySchema)) body: CreateCompetitorPageBodyDto,
  ): Promise<CompetitorPageResponseDto> {
    const row = await this.service.createCompetitorPage(body);
    return toCompetitorPageResponseDto(row);
  }

  /** `DELETE /api/v1/competitors/:id`. */
  @Delete("competitors/:id")
  @HttpCode(204)
  async deleteCompetitor(@Param("id") id: string): Promise<void> {
    await this.service.deleteCompetitorPage(id);
  }
}

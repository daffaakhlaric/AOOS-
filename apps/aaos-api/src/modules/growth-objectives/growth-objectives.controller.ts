import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";

import { TenantId } from "../../common/tenant-context.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import {
  CreateGrowthObjectiveBodySchema,
  type CreateGrowthObjectiveBodyDto,
  type GrowthObjectiveListResponseDto,
  type GrowthObjectiveResponseDto,
  type PacingResponseDto,
} from "./dto/growth-objective.dto.js";
import { GrowthObjectivesService } from "./growth-objectives.service.js";

/**
 * `GET/POST /api/v1/growth-objectives`, `GET /:id`, `POST /:id/activate`, `POST /:id/analyze`,
 * `GET /:id/pacing` —
 * `x-api-key` auth (same perimeter as every other `aaos-api` module), tenant-scoped via `@TenantId()`.
 *
 * `/replan` (a dedicated re-analysis trigger distinct from `/analyze`) and a standalone `/forecast`
 * read route remain out of scope for this phase — `GET /:id` already exposes the last stored
 * `forecast`/`forecastComputedAt`, and `/analyze` itself is the only real way to (re)compute one
 * today (legal from `DRAFT`/`REPLANNING`, see `GrowthObjectivesService.analyze`'s own doc).
 */
@Controller("api/v1/growth-objectives")
@UseGuards(ApiKeyGuard)
export class GrowthObjectivesController {
  constructor(private readonly service: GrowthObjectivesService) {}

  @Get()
  async list(@TenantId() tenantId: string): Promise<GrowthObjectiveListResponseDto> {
    return this.service.list(tenantId);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(CreateGrowthObjectiveBodySchema))
    body: CreateGrowthObjectiveBodyDto,
  ): Promise<GrowthObjectiveResponseDto> {
    return this.service.create(tenantId, body);
  }

  @Get(":id")
  async byId(
    @TenantId() tenantId: string,
    @Param("id") id: string,
  ): Promise<GrowthObjectiveResponseDto> {
    return this.service.getById(tenantId, id);
  }

  @Post(":id/activate")
  @HttpCode(200)
  async activate(
    @TenantId() tenantId: string,
    @Param("id") id: string,
  ): Promise<GrowthObjectiveResponseDto> {
    return this.service.activate(tenantId, id);
  }

  @Post(":id/analyze")
  @HttpCode(200)
  async analyze(
    @TenantId() tenantId: string,
    @Param("id") id: string,
  ): Promise<GrowthObjectiveResponseDto> {
    return this.service.analyze(tenantId, id);
  }

  @Get(":id/pacing")
  async pacing(@TenantId() tenantId: string, @Param("id") id: string): Promise<PacingResponseDto> {
    return this.service.pacing(tenantId, id);
  }
}

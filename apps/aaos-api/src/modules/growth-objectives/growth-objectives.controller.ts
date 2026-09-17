import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";

import { TenantId } from "../../common/tenant-context.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import {
  CreateGrowthObjectiveBodySchema,
  type CreateGrowthObjectiveBodyDto,
  type GrowthObjectiveListResponseDto,
  type GrowthObjectiveResponseDto,
} from "./dto/growth-objective.dto.js";
import { GrowthObjectivesService } from "./growth-objectives.service.js";

/**
 * `GET/POST /api/v1/growth-objectives`, `GET /:id`, `POST /:id/activate` — `x-api-key` auth (same
 * perimeter as every other `aaos-api` module), tenant-scoped via `@TenantId()`.
 *
 * `/analyze`, `/replan`, `/forecast` are deliberately NOT implemented here — those need the
 * Reverse Funnel/Feasibility engines, a separate, later phase (Phase 1 Part B). Stub routes are
 * left commented out below as a landing spot for that work, never as dead/fake endpoints.
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

  // Phase 1 Part B — POST ":id/analyze" (Reverse Funnel + Feasibility, produces PLANNED)
  // Phase 1 Part B — POST ":id/replan"
  // Phase 1 Part B — GET ":id/forecast"
}

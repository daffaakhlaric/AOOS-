import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from "@nestjs/common";

import { CorrelationId } from "../../common/correlation.js";
import { TenantId } from "../../common/tenant-context.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import {
  BudgetSuggestionQuerySchema,
  CreatePropertyObjectiveBodySchema,
  type BudgetSuggestionQueryDto,
  type BudgetSuggestionResponseDto,
  type CreatePropertyObjectiveBodyDto,
  type PropertyObjectiveResponseDto,
} from "./dto/property-objective.dto.js";
import { PropertyObjectiveService } from "./property-objective.service.js";

/**
 * `GET/POST /api/v1/property-objective` + `GET /api/v1/property-objective/budget-suggestion`
 * (Phase O1) — the genuinely SEPARATE PROPERTY equivalent of `ObjectiveController`. `x-api-key`
 * auth via `ApiKeyGuard`, the same auth convention every other manager-facing controller in this
 * app already uses. `get`/`create` are `@TenantId()`-scoped (`common/tenant-context.ts`) — per this
 * session's own Phase T1 tenant-scoping lesson, applied here from day one.
 *
 * `budget-suggestion` is the ONE real exception, and honestly so, not an oversight: it computes its
 * suggestion from `MetaAdsService.pullCampaigns`, which itself has no `tenantId` parameter and no
 * `@TenantId()` on `MetaAdsController` today — this whole `meta-ads` module pulls from one
 * environment-wide configured Meta ad account, the same real single-tenant-per-environment
 * architecture gap Phase T1 fixed for `assets`/`meta-interests` but did NOT touch here (out of that
 * phase's scope). Threading a real per-tenant scope through `budget-suggestion` would require fixing
 * `MetaAdsService` itself first — flagged to the coordinator as a real, separate follow-up, not
 * silently worked around by inventing a second Meta-pull mechanism in this module.
 *
 * `budget-suggestion` is declared BEFORE the bare `POST`/`GET` routes' handlers are irrelevant here
 * (both live under the same fixed `/budget-suggestion` sub-path, not a `:id`-style dynamic segment,
 * so there is no route-ordering hazard like `AssetsController`'s `stats`-before-`:id` concern).
 */
@Controller("api/v1/property-objective")
@UseGuards(ApiKeyGuard)
export class PropertyObjectiveController {
  constructor(private readonly service: PropertyObjectiveService) {}

  @Get("budget-suggestion")
  async getBudgetSuggestion(
    @Query(new ZodValidationPipe(BudgetSuggestionQuerySchema)) query: BudgetSuggestionQueryDto,
    @CorrelationId() correlationId: string,
  ): Promise<BudgetSuggestionResponseDto> {
    return this.service.getBudgetSuggestion(query.targetHotLeads, correlationId);
  }

  @Get()
  async get(@TenantId() tenantId: string): Promise<PropertyObjectiveResponseDto> {
    return this.service.get(tenantId);
  }

  @Post()
  @HttpCode(201)
  async create(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(CreatePropertyObjectiveBodySchema))
    body: CreatePropertyObjectiveBodyDto,
  ): Promise<PropertyObjectiveResponseDto> {
    return this.service.create(tenantId, body);
  }
}

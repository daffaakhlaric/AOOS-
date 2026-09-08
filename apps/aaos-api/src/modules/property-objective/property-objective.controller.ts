import { Body, Controller, Get, HttpCode, Patch, Post, Query, UseGuards } from "@nestjs/common";

import { CorrelationId } from "../../common/correlation.js";
import { TenantId } from "../../common/tenant-context.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import {
  BudgetSuggestionQuerySchema,
  CreatePropertyObjectiveBodySchema,
  UpdateAutoLoopSettingsBodySchema,
  UpdateAutoPublishSettingsBodySchema,
  UpdateBusinessContextBodySchema,
  type BudgetSuggestionQueryDto,
  type BudgetSuggestionResponseDto,
  type CreatePropertyObjectiveBodyDto,
  type PropertyObjectiveResponseDto,
  type UpdateAutoLoopSettingsBodyDto,
  type UpdateAutoPublishSettingsBodyDto,
  type UpdateBusinessContextBodyDto,
} from "./dto/property-objective.dto.js";
import { PropertyObjectiveService } from "./property-objective.service.js";

/**
 * `GET/POST /api/v1/property-objective` + `GET /api/v1/property-objective/budget-suggestion`
 * (Phase O1) — the genuinely SEPARATE PROPERTY equivalent of `ObjectiveController`. `x-api-key`
 * auth via `ApiKeyGuard`, the same auth convention every other manager-facing controller in this
 * app already uses. `get`/`create` are `@TenantId()`-scoped (`common/tenant-context.ts`) — per this
 * session's own Phase T1 tenant-scoping lesson, applied here from day one.
 *
 * `budget-suggestion` is now ALSO `@TenantId()`-scoped (TENANT-SCOPING FIX, Phase T2,
 * docs/PROMPT-AAOS-META-ADS-TENANT-SCOPING.md): it computes its suggestion from
 * `MetaAdsService.pullCampaigns`, which used to have no `tenantId` parameter — this was the exact,
 * previously-flagged follow-up this doc comment's own earlier version called out as blocked on
 * fixing `MetaAdsService` itself first. That fix landed in this same phase, so this endpoint is
 * updated alongside it rather than left on the stale env-wide tenant.
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
    @TenantId() tenantId: string,
  ): Promise<BudgetSuggestionResponseDto> {
    return this.service.getBudgetSuggestion(query.targetHotLeads, correlationId, tenantId);
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

  /** AAOS LOOP UPGRADE, Sprint 6 Prompt 15 — the real "Konteks Bisnis" card write. */
  @Patch("business-context")
  async updateBusinessContext(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(UpdateBusinessContextBodySchema))
    body: UpdateBusinessContextBodyDto,
  ): Promise<PropertyObjectiveResponseDto> {
    return this.service.updateBusinessContext(tenantId, body);
  }

  /** AAOS LOOP UPGRADE, Sprint 8a — the real NEED_CREATIVE auto-brief guardrail settings write (`max_auto_briefs_per_day`, `auto_approve_creative_brief`, default OFF). */
  @Patch("auto-loop-settings")
  async updateAutoLoopSettings(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(UpdateAutoLoopSettingsBodySchema))
    body: UpdateAutoLoopSettingsBodyDto,
  ): Promise<PropertyObjectiveResponseDto> {
    return this.service.updateAutoLoopSettings(tenantId, body);
  }

  /** AAOS LOOP UPGRADE, Sprint 8c — the real campaign-publish guardrail settings write (`auto_publish_campaign` default OFF, `max_budget_increase_pct` default 20). */
  @Patch("auto-publish-settings")
  async updateAutoPublishSettings(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(UpdateAutoPublishSettingsBodySchema))
    body: UpdateAutoPublishSettingsBodyDto,
  ): Promise<PropertyObjectiveResponseDto> {
    return this.service.updateAutoPublishSettings(tenantId, body);
  }
}

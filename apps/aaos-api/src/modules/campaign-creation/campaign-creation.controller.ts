import { randomUUID } from "node:crypto";

import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";

import { TenantId } from "../../common/tenant-context.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { CampaignCreationService } from "./campaign-creation.service.js";
import type {
  CampaignBlueprintResponseDto,
  CampaignCreationResponseDto,
  CampaignPreflightResponseDto,
  ListingReadinessResponseDto,
  PortfolioPlanResponseDto,
  StrategyMemoryResponseDto,
} from "./dto/campaign-creation.dto.js";

/**
 * `/api/v1/campaign-creation/...` — EYVRA SAMANTHA V2 Phase 25 (PROMPT 32/33/35) + Phase 26
 * (PROMPT 36/37). `x-api-key` auth (same perimeter as every other `aaos-api` module),
 * tenant-scoped via `@TenantId()`.
 *
 * The three `GET` routes are read-only planning/assessment — zero mutation, zero Meta API call.
 * `POST .../create` (Phase 26) is the first real Meta-mutating route in this module — see
 * `CampaignCreationService.createCampaign`'s own doc for the full safety discipline. Deliberately
 * API-surface-only this phase: no frontend trigger exists yet anywhere in this codebase for this
 * route (out of scope — see this phase's own instructions).
 */
@Controller("api/v1/campaign-creation")
@UseGuards(ApiKeyGuard)
export class CampaignCreationController {
  constructor(private readonly service: CampaignCreationService) {}

  @Get("listings/:listingId/readiness")
  async listingReadiness(
    @TenantId() tenantId: string,
    @Param("listingId") listingId: string,
  ): Promise<ListingReadinessResponseDto> {
    return this.service.getListingReadiness(tenantId, listingId);
  }

  @Get("growth-objectives/:growthObjectiveId/listings/:listingId/blueprint")
  async blueprint(
    @TenantId() tenantId: string,
    @Param("growthObjectiveId") growthObjectiveId: string,
    @Param("listingId") listingId: string,
  ): Promise<CampaignBlueprintResponseDto> {
    return this.service.getBlueprint(tenantId, growthObjectiveId, listingId);
  }

  @Get("growth-objectives/:growthObjectiveId/listings/:listingId/preflight")
  async preflight(
    @TenantId() tenantId: string,
    @Param("growthObjectiveId") growthObjectiveId: string,
    @Param("listingId") listingId: string,
  ): Promise<CampaignPreflightResponseDto> {
    return this.service.getPreflight(tenantId, growthObjectiveId, listingId);
  }

  /**
   * `GET /api/v1/campaign-creation/growth-objectives/:growthObjectiveId/portfolio-plan` — EYVRA
   * SAMANTHA V2 Phase 32. Read-only, same as `blueprint`/`preflight` above.
   */
  @Get("growth-objectives/:growthObjectiveId/portfolio-plan")
  async portfolioPlan(
    @TenantId() tenantId: string,
    @Param("growthObjectiveId") growthObjectiveId: string,
  ): Promise<PortfolioPlanResponseDto> {
    return this.service.getPortfolioPlan(tenantId, growthObjectiveId);
  }

  /**
   * `GET /api/v1/campaign-creation/growth-objectives/:growthObjectiveId/listings/:listingId/strategy-memory`
   * — EYVRA SAMANTHA V2 Phase 33 (PROMPT 34). Read-only, same as `blueprint`/`preflight`/
   * `portfolioPlan` above.
   */
  @Get("growth-objectives/:growthObjectiveId/listings/:listingId/strategy-memory")
  async strategyMemory(
    @TenantId() tenantId: string,
    @Param("growthObjectiveId") growthObjectiveId: string,
    @Param("listingId") listingId: string,
  ): Promise<StrategyMemoryResponseDto> {
    return this.service.getStrategyMemory(tenantId, growthObjectiveId, listingId);
  }

  /**
   * `POST /api/v1/campaign-creation/growth-objectives/:growthObjectiveId/listings/:listingId/create`
   * — Phase 26 (PROMPT 36/37). Real Meta mutation, PAUSED-first, idempotent — see
   * `CampaignCreationService.createCampaign`'s own doc. `correlationId` is generated per-request
   * here (no request body/header carries one yet on this route — same "generate one at the
   * controller boundary when none is supplied" fallback `GoLiveController`'s own real call sites
   * use for logging/tracing).
   */
  @Post("growth-objectives/:growthObjectiveId/listings/:listingId/create")
  async create(
    @TenantId() tenantId: string,
    @Param("growthObjectiveId") growthObjectiveId: string,
    @Param("listingId") listingId: string,
  ): Promise<CampaignCreationResponseDto> {
    return this.service.createCampaign(tenantId, growthObjectiveId, listingId, randomUUID());
  }
}

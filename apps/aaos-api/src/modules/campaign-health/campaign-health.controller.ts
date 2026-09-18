import { Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";

import { TenantId } from "../../common/tenant-context.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { CampaignHealthService } from "./campaign-health.service.js";
import {
  CampaignAssessmentHistoryQuerySchema,
  type CampaignAssessmentHistoryQueryDto,
} from "./dto/campaign-assessment-history-query.dto.js";
import type { CampaignHealthResponseDto } from "./dto/campaign-health-response.dto.js";
import type { StoredAssessment } from "./infrastructure/campaign-assessment.repository.js";

/**
 * `GET/POST /api/v1/campaign-health/:campaignId*` — `x-api-key` auth (same perimeter as every
 * other `aaos-api` module), tenant-scoped via `@TenantId()`. `campaignId` is the real
 * `meta_campaign_id`, matching this app's existing `campaigns/:campaignId/history`/
 * `metric-snapshots/campaign/:campaignId` path convention.
 *
 * Two different GET/POST shapes deliberately exist rather than one endpoint with a query flag:
 * `GET /:campaignId` is a quick, on-demand check — purely computed in memory, never persisted,
 * for callers who just want the current picture without adding a row to the campaign's history.
 * `POST /:campaignId/assess` is the record-worthy shape — same computation, plus a real,
 * durable `samantha_campaign_assessments` row a caller can later read back via
 * `GET /:campaignId/history`. Splitting these into distinct routes (rather than a
 * `GET ?persist=true` flag) keeps the safe, side-effect-free default (`GET`) obviously safe, and
 * makes the one endpoint that writes data an explicit `POST` — same REST convention every other
 * compute-and-persist pair in this app follows (see `GrowthObjectivesController`'s `/analyze`).
 */
@Controller("api/v1/campaign-health")
@UseGuards(ApiKeyGuard)
export class CampaignHealthController {
  constructor(private readonly service: CampaignHealthService) {}

  @Get(":campaignId")
  async assess(
    @TenantId() tenantId: string,
    @Param("campaignId") campaignId: string,
  ): Promise<CampaignHealthResponseDto> {
    return this.service.assess(tenantId, campaignId);
  }

  /** `POST /:campaignId/assess` — `200`, not `201`: this computes + persists an audit-trail row, it does not create a REST "resource" the caller addresses afterward (same `@HttpCode(200)` choice `GrowthObjectivesController.analyze`/`.activate` make for their own compute-and-persist endpoints). */
  @Post(":campaignId/assess")
  @HttpCode(200)
  async assessAndRecord(
    @TenantId() tenantId: string,
    @Param("campaignId") campaignId: string,
  ): Promise<CampaignHealthResponseDto> {
    return this.service.assessAndRecord(tenantId, campaignId);
  }

  /** `GET /:campaignId/history?limit=` — real, persisted assessments for this campaign, newest first. Registered after `:campaignId` and `:campaignId/assess` (distinct literal path segments — Nest matches the longer, more specific route, same non-ambiguous routing every other multi-segment controller in this app relies on). */
  @Get(":campaignId/history")
  async history(
    @TenantId() tenantId: string,
    @Param("campaignId") campaignId: string,
    @Query(new ZodValidationPipe(CampaignAssessmentHistoryQuerySchema))
    query: CampaignAssessmentHistoryQueryDto,
  ): Promise<readonly StoredAssessment[]> {
    return this.service.history(tenantId, campaignId, query.limit);
  }
}

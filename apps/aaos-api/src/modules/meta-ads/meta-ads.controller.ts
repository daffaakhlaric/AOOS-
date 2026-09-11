import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";

import { CorrelationId } from "../../common/correlation.js";
import { TenantId } from "../../common/tenant-context.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import {
  CampaignInsightRequestSchema,
  type CampaignInsightRequestDto,
  type CampaignInsightResponseDto,
} from "../llm/dto/campaign-insight.dto.js";
import {
  DiagnoseAdCopyRequestSchema,
  type DiagnoseAdCopyRequestDto,
  type DiagnoseAdCopyResponseDto,
} from "../llm/dto/diagnose-ad-copy.dto.js";

import type { AdAccountOptionDto } from "./dto/ad-account-option.dto.js";
import type { AndromedaHealthResponseDto } from "./dto/andromeda-health.dto.js";
import type { AssetDetailResponseDto } from "./dto/asset-detail.dto.js";
import type { AssetRollupResponseDto } from "./dto/asset-rollup.dto.js";
import type { AdAccountResponseDto } from "./dto/campaign-response.dto.js";
import {
  ExecuteVerdictBodySchema,
  type ExecuteVerdictBodyDto,
  type ExecuteVerdictResponseDto,
} from "./dto/execute-verdict.dto.js";
import type { HeatmapResponseDto } from "./dto/heatmap.dto.js";
import { PullCampaignsQuerySchema, type PullCampaignsQueryDto } from "./dto/pull-campaigns.dto.js";
import { ApiKeyGuard } from "./guards/api-key.guard.js";
import { MetaAdsService } from "./meta-ads.service.js";

/**
 * `GET /api/v1/campaigns`, `POST /api/v1/verdicts` — both require `x-api-key` auth.
 *
 * TENANT-SCOPING FIX (Phase T2, docs/PROMPT-AAOS-META-ADS-TENANT-SCOPING.md): every endpoint here
 * ultimately calls `MetaAdsService`'s `connectorRegistry.resolve` (directly, or via the shared
 * `pullAdAccount` helper), so every one of them now resolves the real per-request tenant via
 * `@TenantId()` (`common/tenant-context.ts` — the same `AssetsController` convention Phase T1
 * already established) and threads it into `MetaAdsService`, instead of the service reading the
 * single, process-wide `AAOS_TENANT_ID` env var.
 */
@Controller("api/v1")
@UseGuards(ApiKeyGuard)
export class MetaAdsController {
  constructor(private readonly metaAdsService: MetaAdsService) {}

  @Get("campaigns")
  async getCampaigns(
    @Query(new ZodValidationPipe(PullCampaignsQuerySchema)) query: PullCampaignsQueryDto,
    @CorrelationId() correlationId: string,
    @TenantId() tenantId: string,
  ): Promise<AdAccountResponseDto> {
    return this.metaAdsService.pullCampaigns(query, correlationId, tenantId);
  }

  /**
   * `GET /api/v1/meta-ads/accounts` — the configured ad accounts (id + resolved display name),
   * backing the dashboard's multi-account pill selector (coordinator note #6 on
   * `docs/PROMPT-AAOS-DASHBOARD-LEAD-SPEND-CABANG-SOURCE.md`). Always returns at least 1 entry
   * (parseAaosApiConfig requires `META_AD_ACCOUNT_IDS` to be non-empty) — the dashboard only
   * needs to render the "Semua Akun" pill when this array has more than 1 element.
   */
  @Get("meta-ads/accounts")
  async getAdAccounts(@TenantId() tenantId: string): Promise<readonly AdAccountOptionDto[]> {
    return this.metaAdsService.getAdAccounts(tenantId);
  }

  /**
   * `GET /api/v1/analytics/assets` — AAOS Analytics Platform Phase 2, "Asset-First Analytics".
   * Same query contract as `GET /api/v1/campaigns` (`adAccountId?`, `datePreset?`) since it pulls
   * the identical underlying `AdAccount` tree, just rolled up by creative asset id instead of
   * returned as the raw campaign hierarchy.
   */
  @Get("analytics/assets")
  async getAssetRollup(
    @Query(new ZodValidationPipe(PullCampaignsQuerySchema)) query: PullCampaignsQueryDto,
    @CorrelationId() correlationId: string,
    @TenantId() tenantId: string,
  ): Promise<AssetRollupResponseDto> {
    return this.metaAdsService.getAssetRollup(query, correlationId, tenantId);
  }

  /**
   * `GET /api/v1/analytics/heatmap` — AAOS Analytics Platform Phase 3, "Audience × Creative
   * Heatmap". Same query contract as `GET /api/v1/analytics/assets` (`adAccountId?`,
   * `datePreset?`) — it pulls the identical underlying `AdAccount` tree, just rolled up by
   * (creative asset × real `AdSet.audienceLabel`) instead of asset alone.
   */
  @Get("analytics/heatmap")
  async getHeatmap(
    @Query(new ZodValidationPipe(PullCampaignsQuerySchema)) query: PullCampaignsQueryDto,
    @CorrelationId() correlationId: string,
    @TenantId() tenantId: string,
  ): Promise<HeatmapResponseDto> {
    return this.metaAdsService.getHeatmap(query, correlationId, tenantId);
  }

  /**
   * `GET /api/v1/analytics/assets/:assetId` — AAOS Analytics Platform Phase 4, "Asset detail /
   * Creative Drill-Down". Same `adAccountId?`/`datePreset?` query contract as
   * `GET /api/v1/analytics/assets`/`GET /api/v1/analytics/heatmap` — see
   * `MetaAdsService.getAssetDetail`'s own docstring for why this is a dedicated route rather than
   * a `?assetId=` filter on the list endpoint. A real `NotFoundError` (→ HTTP 404 via
   * `AaosExceptionFilter`) when no ad in the current pull carries this asset id — never a
   * fabricated empty detail page.
   */
  @Get("analytics/assets/:assetId")
  async getAssetDetail(
    @Param("assetId") assetId: string,
    @Query(new ZodValidationPipe(PullCampaignsQuerySchema)) query: PullCampaignsQueryDto,
    @CorrelationId() correlationId: string,
    @TenantId() tenantId: string,
  ): Promise<AssetDetailResponseDto> {
    return this.metaAdsService.getAssetDetail(assetId, query, correlationId, tenantId);
  }

  /**
   * `GET /api/v1/campaigns/:campaignId/andromeda-health` — Samantha Andromeda-Aware Campaign
   * System, Sprint 2. Same `adAccountId?`/`datePreset?` query contract as
   * `GET /api/v1/analytics/assets/:assetId` — see `MetaAdsService.getAndromedaHealth`'s own doc for
   * why this is a real live-pull endpoint, not a client-side pass-through.
   */
  @Get("campaigns/:campaignId/andromeda-health")
  async getAndromedaHealth(
    @Param("campaignId") campaignId: string,
    @Query(new ZodValidationPipe(PullCampaignsQuerySchema)) query: PullCampaignsQueryDto,
    @CorrelationId() correlationId: string,
    @TenantId() tenantId: string,
  ): Promise<AndromedaHealthResponseDto> {
    return this.metaAdsService.getAndromedaHealth(campaignId, query, correlationId, tenantId);
  }

  @Post("verdicts")
  @HttpCode(200)
  async postVerdict(
    @Body(new ZodValidationPipe(ExecuteVerdictBodySchema)) body: ExecuteVerdictBodyDto,
    @CorrelationId() correlationId: string,
    @TenantId() tenantId: string,
  ): Promise<ExecuteVerdictResponseDto> {
    return this.metaAdsService.executeVerdict(body, correlationId, tenantId);
  }

  /**
   * `POST /api/v1/campaigns/insight` — AAOS-CAMPAIGNS-UNIFIED-PAGE, the unified `/campaigns`
   * page's `CampaignInsightPanel`. See `MetaAdsService.getCampaignInsight`'s own doc for why this
   * is a dedicated pass-through endpoint (the caller already has the campaign tree loaded and
   * pre-aggregated, unlike `getAssetDetail`'s in-process `assetInsight` call).
   */
  @Post("campaigns/insight")
  @HttpCode(200)
  async getCampaignInsight(
    @Body(new ZodValidationPipe(CampaignInsightRequestSchema)) body: CampaignInsightRequestDto,
    @TenantId() tenantId: string,
  ): Promise<CampaignInsightResponseDto> {
    return this.metaAdsService.getCampaignInsight(tenantId, body);
  }

  /**
   * `POST /api/v1/ads/diagnose-copy` — AAOS Samantha Professional Optimizer, Part C. Same
   * dedicated pass-through shape as `POST /api/v1/campaigns/insight` above — see
   * `MetaAdsService.getAdCopyDiagnosis`'s own doc.
   */
  @Post("ads/diagnose-copy")
  @HttpCode(200)
  async getAdCopyDiagnosis(
    @Body(new ZodValidationPipe(DiagnoseAdCopyRequestSchema)) body: DiagnoseAdCopyRequestDto,
    @TenantId() tenantId: string,
  ): Promise<DiagnoseAdCopyResponseDto> {
    return this.metaAdsService.getAdCopyDiagnosis(tenantId, body);
  }
}

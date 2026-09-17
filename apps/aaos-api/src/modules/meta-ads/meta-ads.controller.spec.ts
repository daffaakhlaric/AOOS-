import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import type { CampaignInsightResponseDto } from "../llm/dto/campaign-insight.dto.js";
import type { DiagnoseAdCopyResponseDto } from "../llm/dto/diagnose-ad-copy.dto.js";
import type { MetaSettingsRecommendationResponseDto } from "../llm/dto/meta-settings-recommendation.dto.js";

import type { AdAccountOptionDto } from "./dto/ad-account-option.dto.js";
import type { AssetDetailResponseDto } from "./dto/asset-detail.dto.js";
import type { AdAccountResponseDto } from "./dto/campaign-response.dto.js";
import type { ExecuteVerdictResponseDto } from "./dto/execute-verdict.dto.js";
import { ApiKeyGuard } from "./guards/api-key.guard.js";
import { MetaAdsController } from "./meta-ads.controller.js";
import type { MetaAdsService } from "./meta-ads.service.js";

function buildFakeService(): MetaAdsService {
  return {
    pullCampaigns: vi.fn(async () => ({ id: "act_1" }) as AdAccountResponseDto),
    executeVerdict: vi.fn(
      async () =>
        ({
          action: "PAUSED",
          targetId: "id",
          targetType: "ad",
          simulated: false,
        }) as ExecuteVerdictResponseDto,
    ),
    getAdAccounts: vi.fn(
      async () => [{ id: "act_1", name: "DSS Motor" }] as readonly AdAccountOptionDto[],
    ),
    getAssetDetail: vi.fn(async () => ({ assetId: "hash-A" }) as unknown as AssetDetailResponseDto),
    getCampaignInsight: vi.fn(
      async () =>
        ({
          available: true,
          narrative: "Campaign ini SCALE-worthy.",
          actions: [{ priority: "SEGERA", text: "Naikkan budget." }],
        }) as unknown as CampaignInsightResponseDto,
    ),
    getAdCopyDiagnosis: vi.fn(
      async () =>
        ({
          available: true,
          structural: {
            hook: { status: "YES", reasoning: "Ada hook." },
            clearProblem: { status: "PARTIAL", reasoning: "Kurang jelas." },
            toThePoint: { status: "YES", reasoning: "Singkat." },
            softCta: { status: "NO", reasoning: "Tidak ada CTA." },
          },
        }) as unknown as DiagnoseAdCopyResponseDto,
    ),
    getCampaignListingId: vi.fn(async () => ({ campaignId: "camp-1", listingId: null }) as const),
    getMetaSettingsRecommendation: vi.fn(
      async () =>
        ({
          available: true,
          settingsSummaryCard: { oneLineRecommendation: "Gunakan broad targeting." },
        }) as unknown as MetaSettingsRecommendationResponseDto,
    ),
  } as unknown as MetaAdsService;
}

describe("MetaAdsController", () => {
  it("GET /api/v1/campaigns delegates to MetaAdsService.pullCampaigns with the query + correlation id + real per-request tenant id", async () => {
    const service = buildFakeService();
    const controller = new MetaAdsController(service);
    const result = await controller.getCampaigns(
      { adAccountId: "act_1", datePreset: "last_30d" },
      "corr-1",
      "tenant-a",
    );
    expect(service.pullCampaigns).toHaveBeenCalledWith(
      { adAccountId: "act_1", datePreset: "last_30d" },
      "corr-1",
      "tenant-a",
    );
    expect(result).toEqual({ id: "act_1" });
  });

  it("POST /api/v1/verdicts delegates to MetaAdsService.executeVerdict with the body + correlation id + real per-request tenant id", async () => {
    const service = buildFakeService();
    const controller = new MetaAdsController(service);
    const body = { verdict: "PAUSE" as const, targetId: "id", targetType: "ad" as const };
    const result = await controller.postVerdict(body, "corr-2", "tenant-a");
    expect(service.executeVerdict).toHaveBeenCalledWith(body, "corr-2", "tenant-a");
    expect(result).toEqual({
      action: "PAUSED",
      targetId: "id",
      targetType: "ad",
      simulated: false,
    });
  });

  it("GET /api/v1/meta-ads/accounts delegates to MetaAdsService.getAdAccounts with the real per-request tenant id", async () => {
    const service = buildFakeService();
    const controller = new MetaAdsController(service);
    const result = await controller.getAdAccounts("tenant-a");
    expect(service.getAdAccounts).toHaveBeenCalledWith("tenant-a");
    expect(result).toEqual([{ id: "act_1", name: "DSS Motor" }]);
  });

  it("GET /api/v1/analytics/assets/:assetId delegates to MetaAdsService.getAssetDetail with the assetId + query + correlation id + real per-request tenant id", async () => {
    const service = buildFakeService();
    const controller = new MetaAdsController(service);
    const result = await controller.getAssetDetail(
      "hash-A",
      { adAccountId: "act_1", datePreset: "last_30d" },
      "corr-3",
      "tenant-a",
    );
    expect(service.getAssetDetail).toHaveBeenCalledWith(
      "hash-A",
      { adAccountId: "act_1", datePreset: "last_30d" },
      "corr-3",
      "tenant-a",
    );
    expect(result).toEqual({ assetId: "hash-A" });
  });

  it("POST /api/v1/campaigns/insight delegates to MetaAdsService.getCampaignInsight with the body + real per-request tenant id", async () => {
    const service = buildFakeService();
    const controller = new MetaAdsController(service);
    const body = {
      campaignId: "camp-1",
      campaignName: "Xpander Bintaro",
      verdict: "SCALE",
      spend: 2_500_000,
      totalLead: 12,
      clicks: 340,
      impressions: 15_000,
      maxFrequency: 2.1,
      adCount: 4,
      adSetCount: 2,
      cpl: 208_333,
      benchmarkCplIDR: 250_000,
    } as const;
    const result = await controller.getCampaignInsight(body, "tenant-a");
    expect(service.getCampaignInsight).toHaveBeenCalledWith("tenant-a", body);
    expect(result).toEqual({
      available: true,
      narrative: "Campaign ini SCALE-worthy.",
      actions: [{ priority: "SEGERA", text: "Naikkan budget." }],
    });
  });

  it("GET /api/v1/campaigns/:campaignId/listing-id delegates to MetaAdsService.getCampaignListingId with the real per-request tenant id", async () => {
    const service = buildFakeService();
    const controller = new MetaAdsController(service);
    const result = await controller.getCampaignListingId("camp-1", "tenant-a");
    expect(service.getCampaignListingId).toHaveBeenCalledWith("tenant-a", "camp-1");
    expect(result).toEqual({ campaignId: "camp-1", listingId: null });
  });

  it("POST /api/v1/campaigns/settings-recommendation delegates to MetaAdsService.getMetaSettingsRecommendation with the body + real per-request tenant id", async () => {
    const service = buildFakeService();
    const controller = new MetaAdsController(service);
    const body = {
      campaignId: "camp-1",
      campaignName: "Dijual Tanah di BSD 500m² SHM",
      objective: "OUTCOME_LEADS",
      status: "ACTIVE",
      verdict: "SCALE",
      ctr: 0.02,
      cpl: 35_746,
      benchmarkCplIDR: 100_000,
      benchmarkCtr: 0.025,
      maxFrequency: 1.8,
      totalLead: 60,
      spend: 2_144_749,
      dailyBudget: 750_000,
    } as const;
    const result = await controller.getMetaSettingsRecommendation(body, "tenant-a");
    expect(service.getMetaSettingsRecommendation).toHaveBeenCalledWith("tenant-a", body);
    expect(result).toEqual({
      available: true,
      settingsSummaryCard: { oneLineRecommendation: "Gunakan broad targeting." },
    });
  });

  it("POST /api/v1/ads/diagnose-copy delegates to MetaAdsService.getAdCopyDiagnosis with the body + real per-request tenant id", async () => {
    const service = buildFakeService();
    const controller = new MetaAdsController(service);
    const body = {
      adName: "Xpander Cross 2023",
      primaryText: "DP ringan mulai 15 juta!",
      verdict: "REVIEW",
      isUnderperforming: true,
      spend: 1_200_000,
      conversations: 3,
      rphChatIDR: 400_000,
      frequency: 1.8,
    } as const;
    const result = await controller.getAdCopyDiagnosis(body, "tenant-a");
    expect(service.getAdCopyDiagnosis).toHaveBeenCalledWith("tenant-a", body);
    expect(result).toEqual({
      available: true,
      structural: {
        hook: { status: "YES", reasoning: "Ada hook." },
        clearProblem: { status: "PARTIAL", reasoning: "Kurang jelas." },
        toThePoint: { status: "YES", reasoning: "Singkat." },
        softCta: { status: "NO", reasoning: "Tidak ada CTA." },
      },
    });
  });

  it("guards the whole controller with ApiKeyGuard", () => {
    const guards = Reflect.getMetadata("__guards__", MetaAdsController) as unknown[];
    expect(guards).toContain(ApiKeyGuard);
  });
});

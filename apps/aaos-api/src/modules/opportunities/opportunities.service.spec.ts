import { Verdict } from "@aos/meta-ads-connector";
import { describe, expect, it, vi } from "vitest";

import type { CampaignHealthService } from "../campaign-health/campaign-health.service.js";
import type { CampaignHealthResponseDto } from "../campaign-health/dto/campaign-health-response.dto.js";
import type { CreativeMemoryService } from "../creative-memory/creative-memory.service.js";
import type { AnglePerformanceResponseDto } from "../creative-memory/dto/angle-performance.dto.js";

import { OpportunitiesService } from "./opportunities.service.js";

const TENANT = "propertyklik-demo";
const META_CAMPAIGN_ID = "meta-cmp-1";

function healthResponse(
  overrides: Partial<CampaignHealthResponseDto["decision"]> = {},
): CampaignHealthResponseDto {
  return {
    campaignId: META_CAMPAIGN_ID,
    health: {
      delivery: { status: "HEALTHY", score: 100, confidence: 1, issues: [] },
      costEfficiency: { status: "HEALTHY", score: 100, confidence: 1, issues: [] },
      creative: { status: "HEALTHY", score: 100, confidence: 1, issues: [] },
      audience: { status: "UNKNOWN", confidence: 0, issues: [] },
      conversion: { status: "HEALTHY", score: 100, confidence: 1, issues: [] },
      tracking: { status: "UNKNOWN", confidence: 0, issues: [] },
      leadQuality: { status: "UNKNOWN", confidence: 0, issues: [] },
      overallStatus: "HEALTHY",
    },
    diagnosis: {
      confidence: 0.9,
      impact: "LOW",
      evidence: [],
      contributingFactors: [],
      recommendedFocus: [],
    },
    decision: {
      decision: Verdict.SCALE,
      confidence: 0.9,
      impact: "LOW",
      reason: "Root cause CPL_IMPROVEMENT terdeteksi.",
      riskOfDoingNothing:
        "Momentum performa positif berpotensi tidak dimanfaatkan secara maksimal.",
      expectedOutcome: "Scaling berpotensi memperbesar hasil positif.",
      monitoringPlan: { reviewAfterHours: 72, successConditions: [], rollbackConditions: [] },
      ...overrides,
    },
  };
}

function angleResponse(): AnglePerformanceResponseDto {
  return {
    angles: [
      {
        angle: "family-friendly",
        packageCount: 3,
        aggregated: {
          spend: 1_000_000,
          impressions: 25_000,
          clicks: 500,
          reach: 20_000,
          leads: 20,
          cpl: 50_000,
        },
        dataSufficiency: { level: "HIGH", score: 90, reasons: [] },
        rank: 1,
      },
      {
        angle: "investment",
        packageCount: 2,
        aggregated: {
          spend: 500_000,
          impressions: 10_000,
          clicks: 200,
          reach: 8_000,
          leads: 5,
          cpl: 100_000,
        },
        dataSufficiency: { level: "MEDIUM", score: 60, reasons: [] },
        rank: 2,
      },
    ],
  };
}

function buildFakeCampaignHealthService(
  response: CampaignHealthResponseDto,
): CampaignHealthService {
  return { assess: vi.fn(async () => response) } as unknown as CampaignHealthService;
}

function buildFakeCreativeMemoryService(
  response: AnglePerformanceResponseDto,
): CreativeMemoryService {
  return { getAnglePerformance: vi.fn(async () => response) } as unknown as CreativeMemoryService;
}

describe("OpportunitiesService", () => {
  it("calls both real services with the tenant id and campaign id", async () => {
    const campaignHealthService = buildFakeCampaignHealthService(healthResponse());
    const creativeMemoryService = buildFakeCreativeMemoryService(angleResponse());
    const service = new OpportunitiesService(campaignHealthService, creativeMemoryService);

    await service.detect(TENANT, META_CAMPAIGN_ID);

    expect(campaignHealthService.assess).toHaveBeenCalledWith(TENANT, META_CAMPAIGN_ID);
    expect(creativeMemoryService.getAnglePerformance).toHaveBeenCalledWith(TENANT);
  });

  it("merges a real SCALING_OPPORTUNITY with every CREATIVE_WINNER_EXPANSION", async () => {
    const campaignHealthService = buildFakeCampaignHealthService(healthResponse());
    const creativeMemoryService = buildFakeCreativeMemoryService(angleResponse());
    const service = new OpportunitiesService(campaignHealthService, creativeMemoryService);

    const result = await service.detect(TENANT, META_CAMPAIGN_ID);

    expect(result.campaignId).toBe(META_CAMPAIGN_ID);
    expect(result.opportunities).toHaveLength(2);
    expect(result.opportunities.map((o) => o.type)).toEqual([
      "SCALING_OPPORTUNITY",
      "CREATIVE_WINNER_EXPANSION",
    ]);
  });

  it("omits the scaling opportunity when the decision is not Verdict.SCALE, keeping creative winners", async () => {
    const campaignHealthService = buildFakeCampaignHealthService(
      healthResponse({ decision: "NO_ACTION", confidence: 1 }),
    );
    const creativeMemoryService = buildFakeCreativeMemoryService(angleResponse());
    const service = new OpportunitiesService(campaignHealthService, creativeMemoryService);

    const result = await service.detect(TENANT, META_CAMPAIGN_ID);

    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0]?.type).toBe("CREATIVE_WINNER_EXPANSION");
  });

  it("returns an honest empty opportunities: [] when neither detector fires", async () => {
    const campaignHealthService = buildFakeCampaignHealthService(
      healthResponse({ decision: "NO_ACTION", confidence: 1 }),
    );
    const creativeMemoryService = buildFakeCreativeMemoryService({ angles: [] });
    const service = new OpportunitiesService(campaignHealthService, creativeMemoryService);

    const result = await service.detect(TENANT, META_CAMPAIGN_ID);

    expect(result).toEqual({ campaignId: META_CAMPAIGN_ID, opportunities: [] });
  });
});

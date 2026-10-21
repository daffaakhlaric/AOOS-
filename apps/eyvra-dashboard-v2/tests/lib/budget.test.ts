import { expect, it } from "vitest";
import { mapCampaignPortfolioItem, type PortfolioCampaign } from "@/lib/campaigns";
import {
  computeBudgetPacing,
  computeFatiguedSpendWaste,
  mapSamanthaBudgetDecision,
} from "@/lib/budget";
import type {
  CampaignHealthDto,
  CampaignHealthSummaryEntryDto,
  HealthStatus,
} from "@/types/dashboard.types";
import type { CreativeGalleryItem } from "@/lib/creative-health";

function makeHealth(overallStatus: HealthStatus): CampaignHealthDto {
  const dim = { status: overallStatus, confidence: 1, issues: [] as string[] };
  const unknown = { status: "UNKNOWN" as HealthStatus, confidence: 0, issues: [] as string[] };
  return {
    delivery: dim,
    costEfficiency: dim,
    creative: dim,
    audience: unknown,
    conversion: dim,
    tracking: unknown,
    leadQuality: unknown,
    overallStatus,
  };
}

const campaign: PortfolioCampaign = {
  id: "c",
  metaId: "123",
  stableId: "CMP-1",
  name: "Campaign",
  status: "ACTIVE",
  objective: "LEADS",
  spend: 200000,
  dailyBudget: 100000,
  accountId: "act_1",
  accountName: "Account",
  syncedAt: "2026-09-25T01:00:00Z",
  adSets: [],
};

function assessmentWith(
  decision: CampaignHealthSummaryEntryDto["decision"],
): CampaignHealthSummaryEntryDto {
  return {
    campaignId: "123",
    campaignName: "Campaign",
    spend: 200000,
    health: makeHealth("HEALTHY"),
    diagnosis: {
      confidence: decision.confidence,
      impact: decision.impact,
      evidence: [],
      contributingFactors: [],
      recommendedFocus: [],
    },
    decision,
  };
}

it("maps a real SCALE decision honestly — no invented target budget number", () => {
  const item = mapCampaignPortfolioItem(
    campaign,
    assessmentWith({
      decision: "SCALE",
      confidence: 0.82,
      impact: "MEDIUM",
      reason: "CTR_IMPROVEMENT terdeteksi.",
      riskOfDoingNothing: "Momentum positif tidak dimanfaatkan.",
      expectedOutcome: "Scaling berpotensi memperbesar hasil positif.",
      monitoringPlan: { reviewAfterHours: 72, successConditions: [], rollbackConditions: [] },
    }),
  );
  const model = mapSamanthaBudgetDecision(item);
  expect(model.posture).toBe("SCALE");
  expect(model.decisionLabel).toBe("Scale campaign");
  expect(model.confidencePct).toBe(82);
  expect(model.recommendationNote).toMatch(/nominal\/persentase rekomendasi belum dihitung sistem/);
});

it("buckets PAUSE/FIX as ATTENTION — never a bare invented HOLD for a real severe verdict", () => {
  const item = mapCampaignPortfolioItem(
    campaign,
    assessmentWith({
      decision: "PAUSE",
      confidence: 0.9,
      impact: "CRITICAL",
      reason: "SPEND_WITHOUT_RESULT terdeteksi.",
      riskOfDoingNothing: "Budget terus terpakai.",
      expectedOutcome: "Menghentikan campaign mencegah pemborosan.",
      monitoringPlan: {
        reviewAfterHours: 24,
        successConditions: [],
        rollbackConditions: ["Lead ternyata ada."],
      },
    }),
  );
  const model = mapSamanthaBudgetDecision(item);
  expect(model.posture).toBe("ATTENTION");
  expect(model.rollbackConditions).toEqual(["Lead ternyata ada."]);
});

it("buckets NO_ACTION/MONITOR/KEEP as HOLD", () => {
  const item = mapCampaignPortfolioItem(
    campaign,
    assessmentWith({
      decision: "NO_ACTION",
      confidence: 1,
      impact: "LOW",
      reason: "Semua dimensi HEALTHY.",
      riskOfDoingNothing: "Tidak ada risiko signifikan.",
      expectedOutcome: "Performa berpotensi tetap stabil.",
      monitoringPlan: { reviewAfterHours: 72, successConditions: [], rollbackConditions: [] },
    }),
  );
  expect(mapSamanthaBudgetDecision(item).posture).toBe("HOLD");
});

it("falls back to an honest UNKNOWN posture — never a fabricated decision — when there is no assessment", () => {
  const item = mapCampaignPortfolioItem(campaign);
  const model = mapSamanthaBudgetDecision(item);
  expect(model.posture).toBe("UNKNOWN");
  expect(model.hasDecision).toBe(false);
  expect(model.confidencePct).toBeUndefined();
  expect(model.allowedChangeNow).toMatch(/Belum terhubung/);
});

it("computes Budget Pacing from real budget × real history only, honest gap with no history", () => {
  const item = mapCampaignPortfolioItem(campaign);
  const noHistory = computeBudgetPacing(item, []);
  expect(noHistory.hasData).toBe(false);
  const history = [
    {
      date: "2026-09-20",
      spend: 90000,
      leads: 1,
      ctr: 0.01,
      cpl: 90000,
      clicks: 10,
      impressions: 1000,
    },
    {
      date: "2026-09-21",
      spend: 110000,
      leads: 1,
      ctr: 0.01,
      cpl: 110000,
      clicks: 10,
      impressions: 1000,
    },
  ];
  const pacing = computeBudgetPacing(item, history);
  expect(pacing.hasData).toBe(true);
  expect(pacing.windowDays).toBe(2);
  expect(pacing.periodTarget).toBe(200000);
  expect(pacing.actualSpend).toBe(200000);
  expect(pacing.pacingPct).toBe(100);
  expect(pacing.status).toBe("On Track");
});

it("computes the one real Potential Waste category from real fatigued-creative spend only", () => {
  const gallery = [
    { status: "Fatigued", spend: 40000 },
    { status: "Fatigued", spend: 10000 },
    { status: "Healthy", spend: 999999 },
  ] as unknown as CreativeGalleryItem[];
  const waste = computeFatiguedSpendWaste(gallery);
  expect(waste.fatiguedCount).toBe(2);
  expect(waste.fatiguedSpend).toBe(50000);
});

it("keeps Potential Waste an honest gap (undefined, not 0) when there are no Fatigued creatives", () => {
  const waste = computeFatiguedSpendWaste([]);
  expect(waste.fatiguedCount).toBe(0);
  expect(waste.fatiguedSpend).toBeUndefined();
});

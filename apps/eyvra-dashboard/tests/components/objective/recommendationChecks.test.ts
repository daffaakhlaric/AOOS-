import { describe, expect, it } from "vitest";

import {
  buildRecommendations,
  computePortfolioAvgCplIDR,
  type RecommendationInput,
} from "@/components/objective/recommendationChecks";
import type { CampaignSummaryDto } from "@/types/dashboard.types";
import type { PropertyObjectiveDto } from "@/types/property-objective.types";

// Relative to the real current time (`Date.now()`) — `buildRecommendations` itself compares
// against real `Date.now()`, so these must be relative, not a fixed calendar date, to avoid test
// flakiness as real time passes.
const OLD_DATE = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(); // 20 days ago
const RECENT_DATE = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago

function baseObjective(overrides: Partial<PropertyObjectiveDto> = {}): PropertyObjectiveDto {
  return {
    id: "obj-1",
    tenantId: "tenant-1",
    period: { month: 9, year: 2026 },
    targetHotLeads: 50,
    budgetAllocation: 30_000_000,
    budgetSource: "MANUAL",
    focusListings: [],
    areaPriorities: ["Bintaro"],
    status: "ACTIVE",
    createdAt: RECENT_DATE,
    maxAutoBriefsPerDay: 5,
    autoApproveCreativeBrief: false,
    autoPublishCampaign: false,
    maxBudgetIncreasePct: 20,
    ...overrides,
  };
}

function adWithRphLead(rphLead: number | null, spend = 100_000): CampaignSummaryDto {
  return {
    id: "c1",
    metaId: "c1",
    stableId: "#A",
    name: "Campaign 1",
    objective: "OUTCOME_LEADS",
    status: "ACTIVE",
    spend,
    adSets: [
      {
        id: "as1",
        metaId: "as1",
        stableId: "#A1",
        name: "AdSet 1",
        status: "ACTIVE",
        spend,
        ads: [
          {
            id: "ad1",
            metaId: "ad1",
            stableId: "#A1a",
            name: "Ad 1",
            status: "ACTIVE",
            funnel: "TOFU",
            branch: "main",
            verdict: "MAINTAIN",
            metrics: {
              spend,
              clicks: 10,
              frequency: 1,
              conversations: 5,
              d2: 0,
              d3: 0,
              d5: 0,
              leadForm: 0,
              totalLead: 5,
              rphD3: null,
              rphLead,
              impressions: 100,
            },
          },
        ],
      },
    ],
  };
}

describe("computePortfolioAvgCplIDR", () => {
  it("returns undefined for empty campaigns (never a fabricated 0)", () => {
    expect(computePortfolioAvgCplIDR([])).toBeUndefined();
  });

  it("returns undefined when every ad has a null rphLead", () => {
    expect(computePortfolioAvgCplIDR([adWithRphLead(null)])).toBeUndefined();
  });

  it("averages real, computable rphLead values", () => {
    const campaigns = [adWithRphLead(100_000), adWithRphLead(200_000)];
    expect(computePortfolioAvgCplIDR(campaigns)).toBe(150_000);
  });
});

describe("buildRecommendations", () => {
  it("returns an empty list when there is no current-period objective", () => {
    const input: RecommendationInput = {
      existingObjective: undefined,
      activeListingsCount: 5,
      campaigns: [],
    };
    expect(buildRecommendations(input)).toEqual([]);
  });

  it("flags an incomplete business context", () => {
    const objective = baseObjective({
      avgDealValue: undefined,
      targetCpl: undefined,
      breakevenCpl: undefined,
    });
    const items = buildRecommendations({
      existingObjective: objective,
      activeListingsCount: undefined,
      campaigns: undefined,
    });
    expect(items.map((i) => i.key)).toContain("business-context-missing");
  });

  it("does not flag business context once all 3 real numbers are filled and > 0", () => {
    const objective = baseObjective({
      avgDealValue: 500_000_000,
      targetCpl: 20_000,
      breakevenCpl: 30_000,
    });
    const items = buildRecommendations({
      existingObjective: objective,
      activeListingsCount: undefined,
      campaigns: undefined,
    });
    expect(items.map((i) => i.key)).not.toContain("business-context-missing");
  });

  it("flags breakevenCpl set lower than the real portfolio-average CPL", () => {
    const objective = baseObjective({
      avgDealValue: 500_000_000,
      targetCpl: 20_000,
      breakevenCpl: 30_000,
    });
    const campaigns = [adWithRphLead(50_000)]; // portfolio avg (50k) > breakevenCpl (30k)
    const items = buildRecommendations({
      existingObjective: objective,
      activeListingsCount: undefined,
      campaigns,
    });
    expect(items.map((i) => i.key)).toContain("breakeven-cpl-too-low");
  });

  it("never fabricates the breakeven-CPL check when there is no computable campaign CPL data", () => {
    const objective = baseObjective({
      avgDealValue: 500_000_000,
      targetCpl: 20_000,
      breakevenCpl: 30_000,
    });
    const items = buildRecommendations({
      existingObjective: objective,
      activeListingsCount: undefined,
      campaigns: [adWithRphLead(null)], // no computable rphLead anywhere
    });
    expect(items.map((i) => i.key)).not.toContain("breakeven-cpl-too-low");
  });

  it("does not flag breakevenCpl when the real portfolio average is actually healthy (below breakeven)", () => {
    const objective = baseObjective({
      avgDealValue: 500_000_000,
      targetCpl: 20_000,
      breakevenCpl: 30_000,
    });
    const campaigns = [adWithRphLead(15_000)]; // healthy, below breakeven
    const items = buildRecommendations({
      existingObjective: objective,
      activeListingsCount: undefined,
      campaigns,
    });
    expect(items.map((i) => i.key)).not.toContain("breakeven-cpl-too-low");
  });

  it("flags zero Fokus Listing selected despite having real active listings", () => {
    const objective = baseObjective({ focusListings: [] });
    const items = buildRecommendations({
      existingObjective: objective,
      activeListingsCount: 4,
      campaigns: undefined,
    });
    expect(items.map((i) => i.key)).toContain("focus-listing-empty");
  });

  it("does not flag Fokus Listing coverage while the active-listing count is still loading (undefined)", () => {
    const objective = baseObjective({ focusListings: [] });
    const items = buildRecommendations({
      existingObjective: objective,
      activeListingsCount: undefined,
      campaigns: undefined,
    });
    expect(items.map((i) => i.key)).not.toContain("focus-listing-empty");
  });

  it("does not flag Fokus Listing coverage when the tenant genuinely has 0 active listings", () => {
    const objective = baseObjective({ focusListings: [] });
    const items = buildRecommendations({
      existingObjective: objective,
      activeListingsCount: 0,
      campaigns: undefined,
    });
    expect(items.map((i) => i.key)).not.toContain("focus-listing-empty");
  });

  it("does not flag Fokus Listing coverage once at least 1 listing is selected", () => {
    const objective = baseObjective({ focusListings: ["Cluster Anggrek"] });
    const items = buildRecommendations({
      existingObjective: objective,
      activeListingsCount: 4,
      campaigns: undefined,
    });
    expect(items.map((i) => i.key)).not.toContain("focus-listing-empty");
  });

  it("nudges to review auto-loop defaults once the objective is old and real campaign activity exists", () => {
    const objective = baseObjective({
      createdAt: OLD_DATE,
      autoApproveCreativeBrief: false,
      autoPublishCampaign: false,
    });
    const items = buildRecommendations({
      existingObjective: objective,
      activeListingsCount: undefined,
      campaigns: [adWithRphLead(50_000, 100_000)],
    });
    expect(items.map((i) => i.key)).toContain("auto-loop-defaults-review");
    expect(items.find((i) => i.key === "auto-loop-defaults-review")?.severity).toBe("info");
  });

  it("does not nudge auto-loop review for a freshly created objective", () => {
    const objective = baseObjective({
      createdAt: RECENT_DATE,
      autoApproveCreativeBrief: false,
      autoPublishCampaign: false,
    });
    const items = buildRecommendations({
      existingObjective: objective,
      activeListingsCount: undefined,
      campaigns: [adWithRphLead(50_000, 100_000)],
    });
    expect(items.map((i) => i.key)).not.toContain("auto-loop-defaults-review");
  });

  it("does not nudge auto-loop review when there is no real campaign spend yet", () => {
    const objective = baseObjective({ createdAt: OLD_DATE });
    const items = buildRecommendations({
      existingObjective: objective,
      activeListingsCount: undefined,
      campaigns: [adWithRphLead(50_000, 0)], // 0 spend — no real activity
    });
    expect(items.map((i) => i.key)).not.toContain("auto-loop-defaults-review");
  });

  it("does not nudge auto-loop review once automation has already been turned on", () => {
    const objective = baseObjective({ createdAt: OLD_DATE, autoApproveCreativeBrief: true });
    const items = buildRecommendations({
      existingObjective: objective,
      activeListingsCount: undefined,
      campaigns: [adWithRphLead(50_000, 100_000)],
    });
    expect(items.map((i) => i.key)).not.toContain("auto-loop-defaults-review");
  });

  it("returns an empty list for a fully healthy objective (never fabricates an issue)", () => {
    const objective = baseObjective({
      avgDealValue: 500_000_000,
      targetCpl: 20_000,
      breakevenCpl: 30_000,
      focusListings: ["Cluster Anggrek"],
      createdAt: RECENT_DATE,
    });
    const items = buildRecommendations({
      existingObjective: objective,
      activeListingsCount: 1,
      campaigns: [adWithRphLead(15_000)],
    });
    expect(items).toEqual([]);
  });
});

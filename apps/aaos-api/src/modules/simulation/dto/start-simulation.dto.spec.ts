import { describe, expect, it } from "vitest";

import { StartSimulationBodySchema } from "./start-simulation.dto.js";

/**
 * Real bug fix regression fixture — the ACTUAL shape `apps/aaos-dashboard`'s
 * `SimulationWizardClient.tsx` sends (`campaigns: campaignsData?.campaigns ?? []`, the dashboard's
 * own client-safe, TRIMMED `CampaignSummaryDto`/`AdSetSummaryDto`/`AdSummaryDto`/`AdMetricsDto` —
 * see `start-simulation.dto.ts`'s own docstring for the full explanation). Before this fix, every
 * real "Mulai Simulasi Dry-Run" click failed with a `ZodValidationPipe` "Request validation
 * failed" error listing dozens of missing `metaId`/`funnel`/`branch`/`createdAt`/`dailyBudget`
 * fields the dashboard never had to send in the first place.
 */
const dashboardShapedAd = {
  id: "ad-1",
  stableId: "#C001",
  name: "Ad 1",
  status: "ACTIVE",
  funnel: "DM",
  branch: "BINTARO",
  verdict: "REFRESH",
  metrics: {
    spend: 100,
    frequency: 4.1,
    clicks: 20,
    conversations: 10,
    d2: 1,
    d3: 2,
    d5: 3,
    leadForm: 1,
    totalLead: 2,
    rphD3: null,
    rphLead: null,
  },
};

const dashboardShapedCampaign = {
  id: "campaign-1",
  stableId: "#A001",
  name: "Campaign 1",
  objective: "OUTCOME_LEADS",
  status: "ACTIVE",
  spend: 500000,
  adSets: [
    {
      id: "adset-1",
      stableId: "#B001",
      name: "AdSet 1",
      status: "ACTIVE",
      spend: 50000,
      ads: [dashboardShapedAd],
    },
  ],
};

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    objective: { targetHotLeads: 50, budgetAllocation: 30_000_000 },
    campaignDataSource: "cache",
    campaigns: [dashboardShapedCampaign],
    kaiAd: { name: "Ad 1", branch: "BINTARO" },
    kaiBranch: "BINTARO",
    personaIds: ["ready_buyer"],
    ...overrides,
  };
}

describe("StartSimulationBodySchema", () => {
  it("accepts the REAL trimmed dashboard-sent campaigns shape (regression guard for the real bug fix)", () => {
    const result = StartSimulationBodySchema.safeParse(validBody());
    expect(result.success).toBe(true);
  });

  it("accepts a totals bag whose values include null (real AdMetricsDto.rphD3/rphLead shape — regression guard)", () => {
    const result = StartSimulationBodySchema.safeParse(
      validBody({ totals: { spend: 500000, totalLead: 12, rphD3: null, rphLead: null } }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects a body with zero personaIds selected", () => {
    const result = StartSimulationBodySchema.safeParse(validBody({ personaIds: [] }));
    expect(result.success).toBe(false);
  });
});

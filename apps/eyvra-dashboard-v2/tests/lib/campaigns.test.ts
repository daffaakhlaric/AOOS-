import { describe, expect, it } from "vitest";
import { mapCampaignPortfolioItem, type PortfolioCampaign } from "../../src/lib/campaigns";
const campaign: PortfolioCampaign = {
  id: "internal",
  metaId: "meta",
  stableId: "A1",
  name: "BSD",
  objective: "OUTCOME_LEADS",
  status: "ACTIVE",
  spend: 100000,
  dailyBudget: 0,
  accountId: "act",
  accountName: "Account",
  syncedAt: "2026-09-21",
  adSets: [
    {
      id: "set",
      metaId: "s",
      stableId: "B1",
      name: "Set",
      status: "ACTIVE",
      spend: 100000,
      dailyBudget: 50000,
      ads: [
        {
          id: "a",
          metaId: "a1",
          stableId: "C1",
          name: "Ad",
          status: "ACTIVE",
          verdict: "KEEP",
          metrics: { spend: 100000, clicks: 20, frequency: 1, totalLead: 4 },
        },
      ],
    },
  ],
};
describe("campaign portfolio mapping", () => {
  it("uses Meta lead totals and ad set budgets for ABO", () => {
    const view = mapCampaignPortfolioItem(campaign);
    expect(view.leads).toBe(4);
    expect(view.cpl).toBe(25000);
    expect(view.budget).toBe(50000);
  });
  it("does not infer healthy or zero CPL when evidence is missing", () => {
    const view = mapCampaignPortfolioItem({ ...campaign, adSets: [] });
    expect(view.cpl).toBeUndefined();
    expect(view.health).toBe("UNKNOWN");
    expect(view.state).toBe("Awaiting assessment");
  });
});

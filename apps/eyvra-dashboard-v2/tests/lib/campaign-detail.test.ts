import { expect, it } from "vitest";
import { mapCampaignPortfolioItem, type PortfolioCampaign } from "@/lib/campaigns";
import { mapCampaignDetail, mapLearningGuardian } from "@/lib/campaign-detail";

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
  adSets: [
    {
      id: "s",
      metaId: "s",
      stableId: "s",
      name: "Set",
      status: "ACTIVE",
      spend: 200000,
      dailyBudget: 100000,
      learningStatus: "LEARNING",
      ads: [],
    },
  ],
};
it("uses actual active ad set learning, without inventing confidence or a schedule", () => {
  const model = mapLearningGuardian(mapCampaignPortfolioItem(campaign));
  expect(model.state).toBe("Learning");
  expect(model.confidence).toBe("Belum tersedia");
  expect(model.reviewWindow).toBe("Belum ada monitoring plan.");
});
it("paused campaign takes precedence over stale learning state", () => {
  const model = mapLearningGuardian(mapCampaignPortfolioItem({ ...campaign, status: "PAUSED" }));
  expect(model.state).toBe("Campaign Dijeda");
  expect(model.recommendation).toBe("Tinjau hasil");
});
it("does not treat missing Meta learning status as stability", () => {
  expect(mapLearningGuardian(mapCampaignPortfolioItem({ ...campaign, adSets: [] })).state).toBe(
    "Belum terkonfirmasi",
  );
});
it("keeps unavailable CRM values distinct from measured zero", () => {
  const item = mapCampaignPortfolioItem(campaign);
  expect(mapCampaignDetail(item).hotLeads).toBeUndefined();
  expect(mapCampaignDetail(item, { leads: [], errors: [] }).hotLeads).toBe(0);
  expect(mapCampaignDetail(item, { leads: [], errors: [] }).hotRate).toBeUndefined();
});

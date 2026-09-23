import { expect, it } from "vitest";
import {
  referencesCampaign,
  linkedPackages,
  experimentProgress,
  type CampaignExperiment,
  type CampaignPackage,
} from "@/lib/campaign-workspace";
it("only attributes exact structured campaign references", () => {
  expect(referencesCampaign({ campaignId: "12" }, "12")).toBe(true);
  expect(referencesCampaign({ tool: { input: { campaign_id: "12" } } }, "12")).toBe(true);
  expect(referencesCampaign({ campaignId: "123", reason: "campaign 12" }, "12")).toBe(false);
});
it("does not attach another campaign's unrelated package", () => {
  const packages = [
    { id: "one", adId: "ad1" },
    { id: "two", listingId: "other" },
    { id: "three", publishedMetaAdIds: ["ad1"] },
  ] as CampaignPackage[];
  expect(linkedPackages(packages, ["ad1"], [], "listing").map((p) => p.id)).toEqual([
    "one",
    "three",
  ]);
});
it("requires every variant and minimum duration before readiness", () => {
  const test = {
    thresholdSpend: 100,
    thresholdDays: 2,
    startedAt: "2026-09-20T00:00:00Z",
    variants: [{ spend: 200 }, { spend: 25 }],
  } as CampaignExperiment;
  expect(experimentProgress(test, Date.parse("2026-09-22T00:00:00Z"))).toBe(25);
  expect(experimentProgress({ ...test, variants: [] }, Date.parse("2026-09-22T00:00:00Z"))).toBe(0);
});

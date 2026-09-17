import { describe, expect, it } from "vitest";

import { CampaignInsightAdSchema, CampaignInsightRequestSchema } from "./campaign-insight.dto.js";

const baseRequest = {
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
  dailyBudget: 750_000,
  cpc: 7_353,
  cpm: 166_667,
  reach: 12_000,
};

describe("CampaignInsightRequestSchema", () => {
  it("accepts a pre-Sprint-2 body with none of the new fields (additive, backward-compatible)", () => {
    expect(CampaignInsightRequestSchema.safeParse(baseRequest).success).toBe(true);
  });

  it("accepts a Sprint-2 body with a full per-ad breakdown, learning ad sets, and a market digest", () => {
    const result = CampaignInsightRequestSchema.safeParse({
      ...baseRequest,
      ads: [
        {
          stableId: "#C014",
          name: "Xpander Promo A",
          verdict: "FIX",
          spend: 900_000,
          conversations: 0,
          rphChatIDR: null,
          frequency: 4.2,
          learningStatus: "SUCCESS",
        },
      ],
      learningAdSetStableIds: ["#B002"],
      marketDigest: "Musim ini sedang low-season untuk properti KPR.",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an explicit null marketDigest (honest 'no digest available' — never omitted as a lie)", () => {
    const result = CampaignInsightRequestSchema.safeParse({
      ...baseRequest,
      ads: [],
      learningAdSetStableIds: [],
      marketDigest: null,
    });
    expect(result.success).toBe(true);
  });

  // SAMANTHA ADVANCED INSIGHT ENGINE — new real optional fields, additive/backward-compatible.
  it("accepts a body with real andromedaDiversity/hotLeadsCount/trend arrays", () => {
    const result = CampaignInsightRequestSchema.safeParse({
      ...baseRequest,
      spendTrend7d: [100_000, 110_000],
      resultsTrend7d: [1, 2],
      freqTrend7d: [1.5, 1.8],
      andromedaDiversity: {
        status: "LOW_DIVERSITY",
        totalAdCount: 2,
        distinctCreativeAssetCount: 1,
        reasoning: "Hanya 1 creative unik aktif.",
      },
      hotLeadsCount: 3,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown andromedaDiversity.status value (never a fabricated status)", () => {
    const result = CampaignInsightRequestSchema.safeParse({
      ...baseRequest,
      andromedaDiversity: {
        status: "SUPER_DIVERSE",
        totalAdCount: 2,
        reasoning: "x",
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an ad missing a real stableId", () => {
    const result = CampaignInsightRequestSchema.safeParse({
      ...baseRequest,
      ads: [
        {
          name: "No stableId",
          verdict: "SCALE",
          spend: 0,
          conversations: 0,
          rphChatIDR: null,
          frequency: 0,
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("CampaignInsightAdSchema", () => {
  it("accepts a healthy ad with null rphChatIDR (0 conversations, division-by-zero safe)", () => {
    const result = CampaignInsightAdSchema.safeParse({
      stableId: "#C020",
      name: "Xpander Healthy A",
      verdict: "SCALE",
      spend: 1_000_000,
      conversations: 0,
      rphChatIDR: null,
      frequency: 1.2,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative spend (never a fabricated/impossible metric)", () => {
    const result = CampaignInsightAdSchema.safeParse({
      stableId: "#C020",
      name: "Xpander Healthy A",
      verdict: "SCALE",
      spend: -1,
      conversations: 0,
      rphChatIDR: null,
      frequency: 1.2,
    });
    expect(result.success).toBe(false);
  });
});

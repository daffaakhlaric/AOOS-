import { describe, expect, it } from "vitest";

import {
  CampaignInsightAdSchema,
  CampaignInsightLlmPayloadSchema,
  CampaignInsightRequestSchema,
} from "./campaign-insight.dto.js";

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

// SAMANTHA ADVANCED INSIGHT ENGINE — real, live-confirmed regression: OpenAI's JSON mode often
// emits explicit `null` for an "optional, not applicable" field rather than omitting the key.
// Every optional field below must tolerate BOTH `null` and omission, normalizing to `undefined`
// either way (see `optionalString`/`optionalEnum`'s own doc in campaign-insight.dto.ts).
describe("CampaignInsightLlmPayloadSchema (null-tolerant optional fields)", () => {
  function minimalPayload(overrides: Record<string, unknown> = {}) {
    return {
      triage: { level: "SEHAT", why: "x" },
      verdict: "SCALE",
      confidence: 70,
      verdictOneLiner: "x",
      rootCause: { primary: "x", primaryEvidence: "x" },
      metricBreakdown: [
        {
          metric: "x",
          status: "good",
          interpretation: "x",
          vsContext: "x",
          trend: "stabil",
          trendDetail: "x",
        },
      ],
      whatHappened: "x",
      playbook: {
        immediate: { action: "x", how: "x", why: "x", expectedResult: "x" },
        shortTerm: { action: "x", how: "x", why: "x", expectedResult: "x" },
        mediumTerm: { action: "x", how: "x", why: "x", expectedResult: "x" },
      },
      kaiDirective: { needed: false },
      budgetDecision: {
        recommendation: "maintain",
        currentBudget: 750_000,
        recommendedBudget: 750_000,
        changePercent: 0,
        reasoning: "x",
      },
      scenarios: [
        { name: "A", probability: "70%", steps: ["1"], expectedOutcome: "x", timeToResult: "x" },
      ],
      learnings: ["x"],
      ...overrides,
    };
  }

  it("accepts explicit null for every optional field (real OpenAI JSON-mode behavior), normalizing each to undefined", () => {
    const result = CampaignInsightLlmPayloadSchema.safeParse(
      minimalPayload({
        rootCause: { primary: "x", primaryEvidence: "x", secondary: null, ruled_out: null },
        kaiDirective: {
          needed: false,
          urgency: null,
          brief: null,
          angles_to_avoid: null,
          reasoning: null,
        },
        budgetDecision: {
          recommendation: "maintain",
          currentBudget: 750_000,
          recommendedBudget: 750_000,
          changePercent: 0,
          reasoning: "x",
          prerequisite: null,
          opportunityCost: null,
        },
        competitorContext: null,
        proTip: null,
      }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rootCause.secondary).toBeUndefined();
      expect(result.data.rootCause.ruled_out).toBeUndefined();
      expect(result.data.kaiDirective.urgency).toBeUndefined();
      expect(result.data.kaiDirective.brief).toBeUndefined();
      expect(result.data.competitorContext).toBeUndefined();
      expect(result.data.proTip).toBeUndefined();
    }
  });

  it("still accepts a real, non-null value for every optional field", () => {
    const result = CampaignInsightLlmPayloadSchema.safeParse(
      minimalPayload({
        rootCause: { primary: "x", primaryEvidence: "x", secondary: "real secondary" },
        competitorContext: "real context",
        proTip: "real tip",
      }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rootCause.secondary).toBe("real secondary");
      expect(result.data.competitorContext).toBe("real context");
      expect(result.data.proTip).toBe("real tip");
    }
  });

  it("accepts a single metricBreakdown entry and a single scenario (the real, lenient minimums)", () => {
    const result = CampaignInsightLlmPayloadSchema.safeParse(minimalPayload());
    expect(result.success).toBe(true);
  });
});

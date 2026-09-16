import { describe, expect, it } from "vitest";

import {
  accountBenchmarkCpl,
  aggregateCampaign,
  classifyHealthBucket,
  computeCpl,
  cpcFromAggregate,
  cplTone,
  cpmFromAggregate,
  ctrFromAggregate,
  FREQUENCY_ATTENTION_THRESHOLD,
  FREQUENCY_WARNING_THRESHOLD,
  flattenCampaignAds,
  isFrequencyWarning,
  rphChatIDR,
  type CampaignAggregate,
  type HealthBucketInput,
} from "@/components/campaigns/campaignInsightMath";
import type { AdMetricsDto, AdSummaryDto, CampaignSummaryDto } from "@/types/dashboard.types";

function metrics(overrides: Partial<AdMetricsDto> = {}): AdMetricsDto {
  return {
    spend: 1_000_000,
    clicks: 100,
    frequency: 1.0,
    conversations: 40,
    d2: 20,
    d3: 10,
    d5: 5,
    leadForm: 2,
    totalLead: 8,
    rphD3: null,
    rphLead: null,
    ...overrides,
  };
}

function ad(overrides: Partial<AdSummaryDto> = {}): AdSummaryDto {
  return {
    id: "ad-1",
    metaId: "ad-1",
    stableId: "#C001",
    name: "Ad 1",
    status: "ACTIVE",
    funnel: "DM",
    branch: "BINTARO",
    verdict: "REVIEW",
    metrics: metrics(),
    ...overrides,
  };
}

function campaign(overrides: Partial<CampaignSummaryDto> = {}): CampaignSummaryDto {
  return {
    id: "c1",
    metaId: "c1",
    stableId: "#A001",
    name: "Campaign 1",
    objective: "OUTCOME_LEADS",
    status: "ACTIVE",
    spend: 0,
    dailyBudget: 0,
    adSets: [],
    ...overrides,
  };
}

describe("computeCpl", () => {
  it("returns spend/totalLead", () => {
    expect(computeCpl(1_000_000, 10)).toBe(100_000);
  });

  it("returns null (never a fabricated 0) when totalLead is 0", () => {
    expect(computeCpl(1_000_000, 0)).toBeNull();
  });
});

describe("cplTone", () => {
  it("returns 'good' strictly below 85% of the real benchmark", () => {
    expect(cplTone(84_000, 100_000)).toBe("good");
  });

  it("returns 'warn' within [85%, 115%] of the real benchmark", () => {
    expect(cplTone(85_000, 100_000)).toBe("warn");
    expect(cplTone(100_000, 100_000)).toBe("warn");
    expect(cplTone(115_000, 100_000)).toBe("warn");
  });

  it("returns 'bad' strictly above 115% of the real benchmark", () => {
    expect(cplTone(115_001, 100_000)).toBe("bad");
  });

  it("returns 'unknown' (never a fabricated color) when cpl is null", () => {
    expect(cplTone(null, 100_000)).toBe("unknown");
  });

  it("returns 'unknown' when no real benchmark is available", () => {
    expect(cplTone(100_000, null)).toBe("unknown");
  });
});

describe("rphChatIDR", () => {
  it("returns spend/conversations", () => {
    expect(rphChatIDR(1_000_000, 40)).toBe(25_000);
  });

  it("returns null (never a fabricated 0) when conversations is 0", () => {
    expect(rphChatIDR(1_000_000, 0)).toBeNull();
  });
});

describe("isFrequencyWarning", () => {
  it(`is true strictly above ${FREQUENCY_WARNING_THRESHOLD}`, () => {
    expect(isFrequencyWarning(3.6)).toBe(true);
    expect(isFrequencyWarning(3.5)).toBe(false);
    expect(isFrequencyWarning(3.4)).toBe(false);
  });
});

describe("aggregateCampaign / flattenCampaignAds", () => {
  const twoAdSetCampaign = campaign({
    adSets: [
      {
        id: "as1",
        metaId: "as1",
        stableId: "#B001",
        name: "AdSet 1",
        status: "ACTIVE",
        spend: 100,
        dailyBudget: 500_000,
        ads: [
          ad({
            metrics: metrics({
              spend: 100,
              clicks: 10,
              totalLead: 1,
              frequency: 2.0,
              impressions: 1_000,
            }),
          }),
        ],
      },
      {
        id: "as2",
        metaId: "as2",
        stableId: "#B002",
        name: "AdSet 2",
        status: "ACTIVE",
        spend: 200,
        dailyBudget: 500_000,
        ads: [
          ad({
            id: "ad-2",
            metaId: "ad-2",
            metrics: metrics({ spend: 200, clicks: 20, totalLead: 2, frequency: 5.0 }),
          }),
        ],
      },
    ],
  });

  it("flattens every ad-set's ads", () => {
    expect(flattenCampaignAds(twoAdSetCampaign)).toHaveLength(2);
  });

  it("sums additive fields and takes the MAX of frequency across all ads", () => {
    const result = aggregateCampaign(twoAdSetCampaign);
    expect(result.spend).toBe(300);
    expect(result.clicks).toBe(30);
    expect(result.totalLead).toBe(3);
    expect(result.maxFrequency).toBe(5.0);
    expect(result.adCount).toBe(2);
    expect(result.adSetCount).toBe(2);
  });

  // AdAdvisor-style table (user-requested) — real fields previously never surfaced.
  it("sums real dailyBudget across every real ad set (not per-ad, per-adset)", () => {
    expect(aggregateCampaign(twoAdSetCampaign).dailyBudget).toBe(1_000_000); // 500_000 + 500_000
  });

  // Real ABO-vs-CBO fallback (user-reported gap: "saya cek daily budget masih... kosong") — a CBO
  // campaign's real budget lives on the campaign itself, never on any of its real ad sets.
  it("falls back to the real campaign-level dailyBudget when every ad set's is honestly 0 (the CBO case)", () => {
    const cboCampaign = campaign({
      dailyBudget: 750_000,
      adSets: [
        {
          id: "as1",
          metaId: "as1",
          stableId: "#B001",
          name: "AdSet 1",
          status: "ACTIVE",
          spend: 100,
          dailyBudget: 0,
          ads: [ad()],
        },
      ],
    });
    expect(aggregateCampaign(cboCampaign).dailyBudget).toBe(750_000);
  });

  it("uses the real per-ad-set sum (never the campaign-level field) when the ad-set sum is honestly non-zero (the ABO case)", () => {
    const aboCampaign = campaign({ dailyBudget: 999_999, adSets: twoAdSetCampaign.adSets });
    expect(aggregateCampaign(aboCampaign).dailyBudget).toBe(1_000_000); // real per-adset sum, not the bogus campaign-level value
  });

  it("reach sums only the ads that carry a real value, same honest convention as impressions", () => {
    const oneKnown = campaign({
      adSets: [
        {
          id: "as1",
          metaId: "as1",
          stableId: "#B001",
          name: "AdSet 1",
          status: "ACTIVE",
          spend: 100,
          dailyBudget: 500_000,
          ads: [ad({ metrics: metrics({ reach: 800 }) })],
        },
        {
          id: "as2",
          metaId: "as2",
          stableId: "#B002",
          name: "AdSet 2",
          status: "ACTIVE",
          spend: 200,
          dailyBudget: 500_000,
          ads: [ad({ id: "ad-2", metrics: metrics({ reach: undefined }) })],
        },
      ],
    });
    expect(aggregateCampaign(oneKnown).reach).toBe(800);
  });

  it("reach is null (never a fabricated 0) when NO ad in the campaign carries a real value", () => {
    const noneKnown = campaign({
      adSets: [
        {
          id: "as1",
          metaId: "as1",
          stableId: "#B001",
          name: "AdSet 1",
          status: "ACTIVE",
          spend: 100,
          dailyBudget: 500_000,
          ads: [ad({ metrics: metrics({ reach: undefined }) })],
        },
      ],
    });
    expect(aggregateCampaign(noneKnown).reach).toBeNull();
  });

  it("impressions sums only the ads that carry a real value (same 'known if at least one ad has it' convention as MetricsTab.tsx's aggregateAdMetrics) rather than summing a missing value as 0", () => {
    // twoAdSetCampaign: ad-1 has impressions: 1_000, ad-2 has none — the known value is still
    // reported (1_000), never silently zeroed out by the missing one.
    const result = aggregateCampaign(twoAdSetCampaign);
    expect(result.impressions).toBe(1_000);
  });

  it("impressions is null (never a fabricated 0) when NO ad in the campaign carries a real value", () => {
    const noneKnown = campaign({
      adSets: [
        {
          id: "as1",
          metaId: "as1",
          stableId: "#B001",
          name: "AdSet 1",
          status: "ACTIVE",
          spend: 100,
          dailyBudget: 500_000,
          ads: [ad({ metrics: metrics({ impressions: undefined }) })],
        },
      ],
    });
    expect(aggregateCampaign(noneKnown).impressions).toBeNull();
  });

  it("impressions sums when every ad carries a real value", () => {
    const bothKnown = campaign({
      adSets: [
        {
          id: "as1",
          metaId: "as1",
          stableId: "#B001",
          name: "AdSet 1",
          status: "ACTIVE",
          spend: 100,
          dailyBudget: 500_000,
          ads: [ad({ metrics: metrics({ impressions: 1_000 }) })],
        },
        {
          id: "as2",
          metaId: "as2",
          stableId: "#B002",
          name: "AdSet 2",
          status: "ACTIVE",
          spend: 200,
          dailyBudget: 500_000,
          ads: [ad({ id: "ad-2", metrics: metrics({ impressions: 2_000 }) })],
        },
      ],
    });
    expect(aggregateCampaign(bothKnown).impressions).toBe(3_000);
  });
});

describe("ctrFromAggregate", () => {
  it("returns clicks/impressions when impressions is known and > 0", () => {
    expect(
      ctrFromAggregate({
        spend: 0,
        clicks: 50,
        totalLead: 0,
        impressions: 1_000,
        reach: null,
        dailyBudget: 0,
        maxFrequency: 0,
        adCount: 0,
        adSetCount: 0,
      }),
    ).toBe(0.05);
  });

  it("returns null when impressions is null", () => {
    expect(
      ctrFromAggregate({
        spend: 0,
        clicks: 50,
        totalLead: 0,
        impressions: null,
        reach: null,
        dailyBudget: 0,
        maxFrequency: 0,
        adCount: 0,
        adSetCount: 0,
      }),
    ).toBeNull();
  });
});

function baseAggregate(overrides: Partial<CampaignAggregate> = {}): CampaignAggregate {
  return {
    spend: 0,
    clicks: 0,
    totalLead: 0,
    impressions: null,
    reach: null,
    dailyBudget: 0,
    maxFrequency: 0,
    adCount: 0,
    adSetCount: 0,
    ...overrides,
  };
}

describe("cpcFromAggregate", () => {
  it("returns spend/clicks when clicks is known and > 0", () => {
    expect(cpcFromAggregate(baseAggregate({ spend: 100_000, clicks: 50 }))).toBe(2_000);
  });

  it("returns null (never a fabricated 0) when clicks is 0", () => {
    expect(cpcFromAggregate(baseAggregate({ spend: 100_000, clicks: 0 }))).toBeNull();
  });
});

describe("cpmFromAggregate", () => {
  it("returns (spend/impressions)*1000 when impressions is known and > 0", () => {
    expect(cpmFromAggregate(baseAggregate({ spend: 100_000, impressions: 1_000 }))).toBe(100_000);
  });

  it("returns null when impressions is null", () => {
    expect(cpmFromAggregate(baseAggregate({ spend: 100_000, impressions: null }))).toBeNull();
  });

  it("returns null when impressions is 0", () => {
    expect(cpmFromAggregate(baseAggregate({ spend: 100_000, impressions: 0 }))).toBeNull();
  });
});

describe("accountBenchmarkCpl", () => {
  it("computes real total spend / total leads across every campaign", () => {
    const campaigns: readonly CampaignSummaryDto[] = [
      campaign({
        id: "c1",
        metaId: "c1",
        adSets: [
          {
            id: "as1",
            metaId: "as1",
            stableId: "#B001",
            name: "AdSet 1",
            status: "ACTIVE",
            spend: 100,
            dailyBudget: 500_000,
            ads: [ad({ metrics: metrics({ spend: 1_000_000, totalLead: 10 }) })],
          },
        ],
      }),
      campaign({
        id: "c2",
        metaId: "c2",
        adSets: [
          {
            id: "as2",
            metaId: "as2",
            stableId: "#B002",
            name: "AdSet 2",
            status: "ACTIVE",
            spend: 100,
            dailyBudget: 500_000,
            ads: [ad({ id: "ad-2", metrics: metrics({ spend: 1_000_000, totalLead: 10 }) })],
          },
        ],
      }),
    ];
    expect(accountBenchmarkCpl(campaigns)).toBe(100_000);
  });

  it("returns null (never a fabricated number) when the whole account has 0 real leads", () => {
    expect(accountBenchmarkCpl([campaign()])).toBeNull();
  });
});

describe("classifyHealthBucket (Campaign Page Rebuild v2 — real grouping, reusing existing boundaries)", () => {
  function input(overrides: Partial<HealthBucketInput> = {}): HealthBucketInput {
    return {
      verdict: "KEEP",
      cplTone: "good",
      maxFrequency: 1,
      status: "ACTIVE",
      totalLead: 10,
      spend: 500_000,
      ...overrides,
    };
  }

  it("is healthy for a good-CPL, low-frequency, non-urgent-verdict campaign", () => {
    expect(classifyHealthBucket(input())).toBe("healthy");
  });

  it("is urgent for a real PAUSE verdict", () => {
    expect(classifyHealthBucket(input({ verdict: "PAUSE" }))).toBe("urgent");
  });

  it("is urgent for a real FIX verdict", () => {
    expect(classifyHealthBucket(input({ verdict: "FIX" }))).toBe("urgent");
  });

  it("is urgent when the CPL tone is bad (>115% of benchmark)", () => {
    expect(classifyHealthBucket(input({ cplTone: "bad" }))).toBe("urgent");
  });

  it("is urgent above the real frequency warning threshold", () => {
    expect(classifyHealthBucket(input({ maxFrequency: FREQUENCY_WARNING_THRESHOLD + 0.1 }))).toBe(
      "urgent",
    );
  });

  it("is urgent for an ACTIVE campaign spending real money with honestly 0 leads", () => {
    expect(classifyHealthBucket(input({ totalLead: 0, spend: 200_000, cplTone: "unknown" }))).toBe(
      "urgent",
    );
  });

  it("is NOT urgent for a PAUSED campaign spending with 0 leads (already stopped)", () => {
    expect(
      classifyHealthBucket(
        input({ status: "PAUSED", totalLead: 0, spend: 200_000, cplTone: "unknown" }),
      ),
    ).not.toBe("urgent");
  });

  it("is attention for a real REVIEW verdict", () => {
    expect(classifyHealthBucket(input({ verdict: "REVIEW" }))).toBe("attention");
  });

  it("is attention for a real REFRESH verdict", () => {
    expect(classifyHealthBucket(input({ verdict: "REFRESH" }))).toBe("attention");
  });

  it("is attention when the CPL tone is warn (85-115% of benchmark)", () => {
    expect(classifyHealthBucket(input({ cplTone: "warn" }))).toBe("attention");
  });

  it("is attention above the softer frequency attention threshold but at/below the hard warning", () => {
    expect(classifyHealthBucket(input({ maxFrequency: FREQUENCY_ATTENTION_THRESHOLD + 0.1 }))).toBe(
      "attention",
    );
  });
});

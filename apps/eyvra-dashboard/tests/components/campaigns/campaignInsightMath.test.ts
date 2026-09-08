import { describe, expect, it } from "vitest";

import {
  accountBenchmarkCpl,
  aggregateCampaign,
  computeCpl,
  cplTone,
  ctrFromAggregate,
  FREQUENCY_WARNING_THRESHOLD,
  flattenCampaignAds,
  isFrequencyWarning,
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
    stableId: "#A001",
    name: "Campaign 1",
    objective: "OUTCOME_LEADS",
    status: "ACTIVE",
    spend: 0,
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
        stableId: "#B001",
        name: "AdSet 1",
        status: "ACTIVE",
        spend: 100,
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
        stableId: "#B002",
        name: "AdSet 2",
        status: "ACTIVE",
        spend: 200,
        ads: [
          ad({
            id: "ad-2",
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
          stableId: "#B001",
          name: "AdSet 1",
          status: "ACTIVE",
          spend: 100,
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
          stableId: "#B001",
          name: "AdSet 1",
          status: "ACTIVE",
          spend: 100,
          ads: [ad({ metrics: metrics({ impressions: 1_000 }) })],
        },
        {
          id: "as2",
          stableId: "#B002",
          name: "AdSet 2",
          status: "ACTIVE",
          spend: 200,
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
        maxFrequency: 0,
        adCount: 0,
        adSetCount: 0,
      }),
    ).toBeNull();
  });
});

describe("accountBenchmarkCpl", () => {
  it("computes real total spend / total leads across every campaign", () => {
    const campaigns: readonly CampaignSummaryDto[] = [
      campaign({
        id: "c1",
        adSets: [
          {
            id: "as1",
            stableId: "#B001",
            name: "AdSet 1",
            status: "ACTIVE",
            spend: 100,
            ads: [ad({ metrics: metrics({ spend: 1_000_000, totalLead: 10 }) })],
          },
        ],
      }),
      campaign({
        id: "c2",
        adSets: [
          {
            id: "as2",
            stableId: "#B002",
            name: "AdSet 2",
            status: "ACTIVE",
            spend: 100,
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

import { describe, expect, it } from "vitest";

import {
  MIN_HISTORICAL_SAMPLE_SIZE,
  matchesTarget,
  resolveArea,
  resolvePriceSegment,
  summarizeStrategyMemory,
} from "./strategy-memory.js";
import type { StrategyMemoryCandidate, StrategyMemoryTarget } from "./strategy-memory.js";

const TARGET: StrategyMemoryTarget = {
  propertyType: "RUMAH",
  price: 1_500_000_000,
  city: "Tangerang Selatan",
  province: "Banten",
  objectiveMetric: "HOT_LEADS",
};

function makeCandidate(overrides: Partial<StrategyMemoryCandidate> = {}): StrategyMemoryCandidate {
  return {
    listingId: "hist-listing-1",
    metaCampaignId: "hist-campaign-1",
    propertyType: "RUMAH",
    price: 1_600_000_000,
    city: "Tangerang Selatan",
    province: "Banten",
    objectiveMetric: "HOT_LEADS",
    overallStatus: "HEALTHY",
    costEfficiencyScore: 85,
    assessedAt: "2026-01-05T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolvePriceSegment", () => {
  it("buckets prices into the fixed, documented IDR bands", () => {
    expect(resolvePriceSegment(400_000_000)).toBe("UNDER_500JT");
    expect(resolvePriceSegment(500_000_000)).toBe("500JT_TO_1M");
    expect(resolvePriceSegment(999_999_999)).toBe("500JT_TO_1M");
    expect(resolvePriceSegment(1_000_000_000)).toBe("1M_TO_2M");
    expect(resolvePriceSegment(1_999_999_999)).toBe("1M_TO_2M");
    expect(resolvePriceSegment(2_000_000_000)).toBe("2M_TO_5M");
    expect(resolvePriceSegment(4_999_999_999)).toBe("2M_TO_5M");
    expect(resolvePriceSegment(5_000_000_000)).toBe("OVER_5M");
    expect(resolvePriceSegment(50_000_000_000)).toBe("OVER_5M");
  });
});

describe("resolveArea", () => {
  it("prefers city over province", () => {
    expect(resolveArea("Tangerang Selatan", "Banten")).toBe("Tangerang Selatan");
  });
  it("falls back to province when city is absent", () => {
    expect(resolveArea(undefined, "Banten")).toBe("Banten");
  });
  it("is honestly undefined when neither is present", () => {
    expect(resolveArea(undefined, undefined)).toBeUndefined();
    expect(resolveArea("", "")).toBeUndefined();
  });
});

describe("matchesTarget", () => {
  it("matches when propertyType, price segment, area, and objective are all the same", () => {
    expect(matchesTarget(TARGET, makeCandidate())).toBe(true);
  });

  it("does not match a different propertyType", () => {
    expect(matchesTarget(TARGET, makeCandidate({ propertyType: "APARTEMEN" }))).toBe(false);
  });

  it("does not match a different price segment even at a nearby price", () => {
    expect(matchesTarget(TARGET, makeCandidate({ price: 900_000_000 }))).toBe(false);
  });

  it("matches within the same price segment despite a different exact price", () => {
    expect(matchesTarget(TARGET, makeCandidate({ price: 1_999_000_000 }))).toBe(true);
  });

  it("does not match a different area (city)", () => {
    expect(matchesTarget(TARGET, makeCandidate({ city: "Bekasi", province: "Jawa Barat" }))).toBe(
      false,
    );
  });

  it("falls back to province when city is absent on both sides", () => {
    expect(
      matchesTarget(
        { ...TARGET, city: undefined },
        makeCandidate({ city: undefined, province: "Banten" }),
      ),
    ).toBe(true);
  });

  it("never force-matches when the target has no real city/province", () => {
    expect(
      matchesTarget({ ...TARGET, city: undefined, province: undefined }, makeCandidate()),
    ).toBe(false);
  });

  it("never force-matches when the candidate has no real city/province", () => {
    expect(matchesTarget(TARGET, makeCandidate({ city: undefined, province: undefined }))).toBe(
      false,
    );
  });

  it("does not match a different objective metric", () => {
    expect(matchesTarget(TARGET, makeCandidate({ objectiveMetric: "SOMETHING_ELSE" }))).toBe(false);
  });
});

describe("summarizeStrategyMemory", () => {
  it("honestly degrades to available:false with zero candidates", () => {
    const result = summarizeStrategyMemory(TARGET, []);
    expect(result).toEqual({
      available: false,
      matchedCount: 0,
      reason: expect.stringContaining("Belum ada campaign historis"),
    });
  });

  it(`honestly degrades to available:false with fewer than MIN_HISTORICAL_SAMPLE_SIZE (${String(MIN_HISTORICAL_SAMPLE_SIZE)}) matched candidates — never a fabricated average`, () => {
    const candidates = [
      makeCandidate({ metaCampaignId: "c1" }),
      makeCandidate({ metaCampaignId: "c2" }),
    ];
    expect(candidates.length).toBeLessThan(MIN_HISTORICAL_SAMPLE_SIZE);
    const result = summarizeStrategyMemory(TARGET, candidates);
    expect(result.available).toBe(false);
    if (!result.available) {
      expect(result.matchedCount).toBe(2);
      expect(result.reason).toContain("2");
    }
  });

  it("unmatched candidates never count toward matchedCount, even with plenty of them", () => {
    const candidates = Array.from({ length: 10 }, (_, i) =>
      makeCandidate({ metaCampaignId: `c${String(i)}`, propertyType: "APARTEMEN" }),
    );
    const result = summarizeStrategyMemory(TARGET, candidates);
    expect(result.available).toBe(false);
    if (!result.available) {
      expect(result.matchedCount).toBe(0);
    }
  });

  it("computes a real, honest aggregate once MIN_HISTORICAL_SAMPLE_SIZE is reached", () => {
    const candidates: StrategyMemoryCandidate[] = [
      makeCandidate({ metaCampaignId: "c1", overallStatus: "HEALTHY", costEfficiencyScore: 90 }),
      makeCandidate({ metaCampaignId: "c2", overallStatus: "WATCH", costEfficiencyScore: 70 }),
      makeCandidate({ metaCampaignId: "c3", overallStatus: "CRITICAL", costEfficiencyScore: 20 }),
    ];
    const result = summarizeStrategyMemory(TARGET, candidates);
    expect(result.available).toBe(true);
    if (result.available) {
      expect(result.matchedCount).toBe(3);
      expect(result.statusCounts).toEqual({
        HEALTHY: 1,
        WATCH: 1,
        WARNING: 0,
        CRITICAL: 1,
        UNKNOWN: 0,
      });
      expect(result.favorableStatusRatio).toBeCloseTo(2 / 3);
      expect(result.averageCostEfficiencyScore).toBeCloseTo(60);
      expect(result.costEfficiencySampleSize).toBe(3);
      expect(result.notes.length).toBeGreaterThan(0);
    }
  });

  it("honestly omits favorableStatusRatio when every matched candidate's status is UNKNOWN", () => {
    const candidates: StrategyMemoryCandidate[] = [
      makeCandidate({
        metaCampaignId: "c1",
        overallStatus: "UNKNOWN",
        costEfficiencyScore: undefined,
      }),
      makeCandidate({
        metaCampaignId: "c2",
        overallStatus: "UNKNOWN",
        costEfficiencyScore: undefined,
      }),
      makeCandidate({
        metaCampaignId: "c3",
        overallStatus: "UNKNOWN",
        costEfficiencyScore: undefined,
      }),
    ];
    const result = summarizeStrategyMemory(TARGET, candidates);
    expect(result.available).toBe(true);
    if (result.available) {
      expect(result.favorableStatusRatio).toBeUndefined();
      expect(result.averageCostEfficiencyScore).toBeUndefined();
      expect(result.costEfficiencySampleSize).toBe(0);
      expect(result.statusCounts.UNKNOWN).toBe(3);
    }
  });

  it("averages cost-efficiency only over candidates that have a real, defined score", () => {
    const candidates: StrategyMemoryCandidate[] = [
      makeCandidate({ metaCampaignId: "c1", overallStatus: "HEALTHY", costEfficiencyScore: 100 }),
      makeCandidate({
        metaCampaignId: "c2",
        overallStatus: "HEALTHY",
        costEfficiencyScore: undefined,
      }),
      makeCandidate({ metaCampaignId: "c3", overallStatus: "HEALTHY", costEfficiencyScore: 50 }),
    ];
    const result = summarizeStrategyMemory(TARGET, candidates);
    expect(result.available).toBe(true);
    if (result.available) {
      expect(result.costEfficiencySampleSize).toBe(2);
      expect(result.averageCostEfficiencyScore).toBeCloseTo(75);
      expect(result.notes.some((n) => n.includes("2 dari 3"))).toBe(true);
    }
  });
});

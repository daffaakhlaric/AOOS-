import { describe, expect, it } from "vitest";

import { aggregateInsightRows, type RawInsightCounters } from "./aggregate-insights.js";

function row(overrides: Partial<RawInsightCounters> = {}): RawInsightCounters {
  return { spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0, ...overrides };
}

describe("aggregateInsightRows", () => {
  it("returns all-zero sums and undefined derived ratios for zero rows — never NaN, never a divide-by-zero", () => {
    const result = aggregateInsightRows([]);
    expect(result.spend).toBe(0);
    expect(result.impressions).toBe(0);
    expect(result.clicks).toBe(0);
    expect(result.reach).toBe(0);
    expect(result.leads).toBe(0);
    expect(result.ctr).toBeUndefined();
    expect(result.cpm).toBeUndefined();
    expect(result.cpc).toBeUndefined();
    expect(result.cpl).toBeUndefined();
    expect(result.frequency).toBeUndefined();
  });

  it("handles a single row, deriving every ratio correctly", () => {
    const result = aggregateInsightRows([
      row({ spend: 100_000, impressions: 10_000, clicks: 200, reach: 8_000, leads: 5 }),
    ]);
    expect(result.spend).toBe(100_000);
    expect(result.impressions).toBe(10_000);
    expect(result.clicks).toBe(200);
    expect(result.reach).toBe(8_000);
    expect(result.leads).toBe(5);
    expect(result.ctr).toBeCloseTo(0.02, 10);
    expect(result.cpm).toBeCloseTo(10_000, 10);
    expect(result.cpc).toBeCloseTo(500, 10);
    expect(result.cpl).toBeCloseTo(20_000, 10);
    expect(result.frequency).toBeCloseTo(1.25, 10);
  });

  it("sums raw counters across multiple rows before deriving ratios (never averages per-day ratios)", () => {
    const result = aggregateInsightRows([
      row({ spend: 50_000, impressions: 1_000, clicks: 100, reach: 900, leads: 2 }),
      row({ spend: 150_000, impressions: 9_000, clicks: 100, reach: 8_100, leads: 8 }),
    ]);
    // Day 1 CTR = 10%, day 2 CTR = ~1.1% -- a naive average would land near 5.5%. The real,
    // correct multi-day CTR is total clicks / total impressions.
    expect(result.impressions).toBe(10_000);
    expect(result.clicks).toBe(200);
    expect(result.ctr).toBeCloseTo(200 / 10_000, 10);
    expect(result.ctr).not.toBeCloseTo(0.055, 2);
    expect(result.spend).toBe(200_000);
    expect(result.leads).toBe(10);
    expect(result.cpl).toBeCloseTo(20_000, 10);
  });

  it("cpl is undefined (never 0 or Infinity) when total leads is zero, even with real spend", () => {
    const result = aggregateInsightRows([
      row({ spend: 500_000, impressions: 20_000, clicks: 300, reach: 15_000, leads: 0 }),
    ]);
    expect(result.leads).toBe(0);
    expect(result.cpl).toBeUndefined();
    expect(result.cpl).not.toBe(0);
    expect(Number.isFinite(result.cpl as number)).toBe(false);
  });

  it("ctr/cpm are undefined when impressions is zero even if clicks/spend are somehow nonzero", () => {
    const result = aggregateInsightRows([
      row({ spend: 1_000, clicks: 5, impressions: 0, reach: 0, leads: 0 }),
    ]);
    expect(result.ctr).toBeUndefined();
    expect(result.cpm).toBeUndefined();
  });

  it("cpc is undefined when clicks is zero", () => {
    const result = aggregateInsightRows([row({ spend: 1_000, impressions: 500, clicks: 0 })]);
    expect(result.cpc).toBeUndefined();
  });

  it("frequency is undefined when reach is zero", () => {
    const result = aggregateInsightRows([row({ impressions: 500, reach: 0 })]);
    expect(result.frequency).toBeUndefined();
  });

  it("frequency sums per-day reach as a documented approximation (not deduplicated across days)", () => {
    const result = aggregateInsightRows([
      row({ impressions: 1_000, reach: 900 }),
      row({ impressions: 1_000, reach: 900 }),
    ]);
    // Same 900 real people reached both days would give a TRUE 2-day reach of 900 (frequency ~2.2),
    // but this function honestly sums per-day reach (1800), yielding a lower approximate frequency.
    expect(result.reach).toBe(1_800);
    expect(result.frequency).toBeCloseTo(2_000 / 1_800, 10);
  });
});

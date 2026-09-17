import { describe, expect, it } from "vitest";

import {
  METRIC_WINDOW_KEYS,
  resolveWindowDateRange,
  type MetricWindowKey,
} from "./metric-window.js";

const NOW = new Date("2026-01-31T12:34:56.000Z");

/** Adds `days` (may be negative) to a `YYYY-MM-DD` string, in UTC — test-only helper, independent of the module under test's own `daysBefore`. */
function addDays(dateOnly: string, days: number): string {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function lengthInDays(range: { readonly start: string; readonly end: string }): number {
  const start = new Date(`${range.start}T00:00:00.000Z`).getTime();
  const end = new Date(`${range.end}T00:00:00.000Z`).getTime();
  return Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1;
}

describe("resolveWindowDateRange", () => {
  it("'today' is a single-day range ending on now's UTC date", () => {
    const range = resolveWindowDateRange("today", NOW);
    expect(range).toEqual({ start: "2026-01-31", end: "2026-01-31" });
  });

  it("'yesterday' is a single-day range, the day before today", () => {
    const range = resolveWindowDateRange("yesterday", NOW);
    expect(range).toEqual({ start: "2026-01-30", end: "2026-01-30" });
  });

  it("'lifetime' has no lower bound — resolves to undefined, never a fabricated old date", () => {
    expect(resolveWindowDateRange("lifetime", NOW)).toBeUndefined();
  });

  it("'last_3_days' spans exactly 3 days, ending today", () => {
    const range = resolveWindowDateRange("last_3_days", NOW);
    expect(range).toEqual({ start: "2026-01-29", end: "2026-01-31" });
    expect(lengthInDays(range!)).toBe(3);
  });

  it("'last_7_days' spans exactly 7 days, ending today", () => {
    const range = resolveWindowDateRange("last_7_days", NOW);
    expect(range).toEqual({ start: "2026-01-25", end: "2026-01-31" });
    expect(lengthInDays(range!)).toBe(7);
  });

  it("'last_14_days' spans exactly 14 days, ending today", () => {
    const range = resolveWindowDateRange("last_14_days", NOW);
    expect(range).toEqual({ start: "2026-01-18", end: "2026-01-31" });
    expect(lengthInDays(range!)).toBe(14);
  });

  it("'last_30_days' spans exactly 30 days, ending today", () => {
    const range = resolveWindowDateRange("last_30_days", NOW);
    expect(range).toEqual({ start: "2026-01-02", end: "2026-01-31" });
    expect(lengthInDays(range!)).toBe(30);
  });

  describe.each<[MetricWindowKey, MetricWindowKey, number]>([
    ["last_3_days", "previous_3_days", 3],
    ["last_7_days", "previous_7_days", 7],
    ["last_14_days", "previous_14_days", 14],
    ["last_30_days", "previous_30_days", 30],
  ])("%s vs %s", (lastKey, previousKey, n) => {
    it(`previous window is exactly ${n} days long`, () => {
      const previous = resolveWindowDateRange(previousKey, NOW);
      expect(lengthInDays(previous!)).toBe(n);
    });

    it("previous window ends exactly one day before the last window starts — no gap, no overlap", () => {
      const last = resolveWindowDateRange(lastKey, NOW);
      const previous = resolveWindowDateRange(previousKey, NOW);
      expect(addDays(previous!.end, 1)).toBe(last!.start);
    });

    it("previous window's start is strictly before its own end", () => {
      const previous = resolveWindowDateRange(previousKey, NOW);
      expect(previous!.start < previous!.end).toBe(true);
    });
  });

  it("METRIC_WINDOW_KEYS lists every window and resolveWindowDateRange handles each without throwing", () => {
    expect(METRIC_WINDOW_KEYS).toHaveLength(11);
    for (const key of METRIC_WINDOW_KEYS) {
      expect(() => resolveWindowDateRange(key, NOW)).not.toThrow();
    }
  });

  it("is a pure function of its inputs — same window + same now always resolves identically", () => {
    const a = resolveWindowDateRange("last_7_days", NOW);
    const b = resolveWindowDateRange("last_7_days", new Date(NOW.getTime()));
    expect(a).toEqual(b);
  });

  it("handles a UTC month/year rollover correctly (previous_30_days crossing into the prior year)", () => {
    const range = resolveWindowDateRange("previous_30_days", NOW);
    expect(range).toEqual({ start: "2025-12-03", end: "2026-01-01" });
  });
});

import { describe, expect, it } from "vitest";

import {
  MEDIUM_IMPRESSIONS_THRESHOLD,
  MEDIUM_LEADS_THRESHOLD,
} from "../../metric-snapshot/domain/data-sufficiency.js";
import type { InsightRow } from "../../metric-snapshot/infrastructure/metric-snapshot.repository.js";

import {
  compareRankableByCpl,
  rankAnglePerformance,
  type AnglePerformanceResult,
  type PackagePerformanceInput,
} from "./angle-performance.js";

function row(overrides: Partial<InsightRow> = {}): InsightRow {
  return {
    date: "2026-01-15",
    spend: 100_000,
    impressions: 1_000,
    clicks: 20,
    reach: 900,
    leads: 2,
    ...overrides,
  };
}

/** A row set that clears the MEDIUM data-sufficiency bar on its own (many impressions/leads across many distinct real days). */
function highSufficiencyRows(spendPerDay: number, leadsPerDay: number, days = 7): InsightRow[] {
  return Array.from({ length: days }, (_, index) =>
    row({
      date: `2026-01-${String(10 + index).padStart(2, "0")}`,
      spend: spendPerDay,
      impressions: Math.ceil(MEDIUM_IMPRESSIONS_THRESHOLD / days) + 1,
      clicks: 50,
      reach: Math.ceil(MEDIUM_IMPRESSIONS_THRESHOLD / days),
      leads: leadsPerDay,
    }),
  );
}

function pkg(angle: string, insightRows: readonly InsightRow[]): PackagePerformanceInput {
  return { angle, insightRows };
}

describe("rankAnglePerformance", () => {
  it("returns [] for empty input", () => {
    expect(rankAnglePerformance([])).toEqual([]);
  });

  it("reports a single angle with packageCount 1 and no rank when its data is INSUFFICIENT", () => {
    const results = rankAnglePerformance([pkg("URGENCY", [row({ impressions: 10, leads: 0 })])]);
    expect(results).toHaveLength(1);
    expect(results[0]?.angle).toBe("URGENCY");
    expect(results[0]?.packageCount).toBe(1);
    expect(results[0]?.dataSufficiency.level).toBe("INSUFFICIENT");
    expect(results[0]?.rank).toBeUndefined();
  });

  it("groups multiple packages sharing the same angle before ranking (packageCount reflects the group)", () => {
    const rowsA = highSufficiencyRows(10_000, 3);
    const rowsB = highSufficiencyRows(10_000, 3);
    const results = rankAnglePerformance([pkg("URGENCY", rowsA), pkg("URGENCY", rowsB)]);
    expect(results).toHaveLength(1);
    expect(results[0]?.packageCount).toBe(2);
    expect(results[0]?.aggregated.leads).toBe(6 * 7);
  });

  it("ranks multiple sufficiently-sampled angles by real CPL ascending (1 = lowest CPL)", () => {
    // Cheaper CPL for LIFESTYLE (leads cost less per lead) than URGENCY.
    const urgency = highSufficiencyRows(100_000, MEDIUM_LEADS_THRESHOLD + 5);
    const lifestyle = highSufficiencyRows(20_000, MEDIUM_LEADS_THRESHOLD + 5);
    const results = rankAnglePerformance([pkg("URGENCY", urgency), pkg("LIFESTYLE", lifestyle)]);

    const byAngle = new Map(results.map((r) => [r.angle, r]));
    expect(byAngle.get("URGENCY")?.dataSufficiency.level).not.toBe("INSUFFICIENT");
    expect(byAngle.get("LIFESTYLE")?.dataSufficiency.level).not.toBe("INSUFFICIENT");
    expect(byAngle.get("LIFESTYLE")?.rank).toBe(1);
    expect(byAngle.get("URGENCY")?.rank).toBe(2);
    // Ranked results come first, in real rank order.
    expect(results[0]?.angle).toBe("LIFESTYLE");
    expect(results[1]?.angle).toBe("URGENCY");
  });

  it("excludes an angle with insufficient data from ranking, but still reports it (never silently dropped)", () => {
    const rankableAngle = highSufficiencyRows(50_000, MEDIUM_LEADS_THRESHOLD + 5);
    const results = rankAnglePerformance([
      pkg("RANKABLE", rankableAngle),
      pkg("TOO_NEW", [row({ impressions: 50, leads: 0 })]),
    ]);
    const byAngle = new Map(results.map((r) => [r.angle, r]));
    expect(byAngle.get("RANKABLE")?.rank).toBe(1);
    expect(byAngle.get("TOO_NEW")?.rank).toBeUndefined();
    expect(byAngle.get("TOO_NEW")?.dataSufficiency.level).toBe("INSUFFICIENT");
    expect(results).toHaveLength(2);
  });

  it("assigns no ranks at all when every angle is below the MEDIUM data-sufficiency bar", () => {
    const results = rankAnglePerformance([
      pkg("A", [row({ impressions: 10, leads: 0 })]),
      pkg("B", [row({ impressions: 20, leads: 0 })]),
    ]);
    expect(results.every((r) => r.rank === undefined)).toBe(true);
    expect(results).toHaveLength(2);
  });

  it("real angle with genuinely zero leads never clears MEDIUM (assessDataSufficiency's own leads floor) — so it is reported, unranked, alongside a rankable angle", () => {
    // Spend happened, huge real volume, but zero real conversions — the honest "worst real
    // outcome" case. `assessDataSufficiency`'s LOW/MEDIUM gates both require leads above a nonzero
    // floor, so this angle tops out at LOW no matter how large impressions/days are.
    const zeroLeadHighVolume = highSufficiencyRows(50_000, 0).map((r) => ({
      ...r,
      impressions: MEDIUM_IMPRESSIONS_THRESHOLD,
      reach: MEDIUM_IMPRESSIONS_THRESHOLD,
      leads: 0,
    }));
    const realLeads = highSufficiencyRows(50_000, MEDIUM_LEADS_THRESHOLD + 1);
    const results = rankAnglePerformance([
      pkg("ZERO_LEAD", zeroLeadHighVolume),
      pkg("REAL_LEADS", realLeads),
    ]);
    const byAngle = new Map(results.map((r) => [r.angle, r]));
    expect(byAngle.get("ZERO_LEAD")?.aggregated.cpl).toBeUndefined();
    expect(byAngle.get("ZERO_LEAD")?.dataSufficiency.level).toBe("LOW");
    expect(byAngle.get("ZERO_LEAD")?.rank).toBeUndefined();
    expect(byAngle.get("REAL_LEADS")?.rank).toBe(1);
  });
});

describe("compareRankableByCpl", () => {
  function result(angle: string, cpl: number | undefined): AnglePerformanceResult {
    return {
      angle,
      packageCount: 1,
      aggregated: { spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0, cpl },
      dataSufficiency: { level: "MEDIUM", score: 60, reasons: [] },
    };
  }

  it("orders two real positive CPLs ascending (lower CPL first)", () => {
    expect(compareRankableByCpl(result("A", 50_000), result("B", 20_000))).toBeGreaterThan(0);
    expect(compareRankableByCpl(result("A", 20_000), result("B", 50_000))).toBeLessThan(0);
  });

  it("places a zero-lead (undefined CPL) angle AFTER any angle with a real positive CPL, never before", () => {
    expect(compareRankableByCpl(result("ZERO", undefined), result("REAL", 20_000))).toBeGreaterThan(
      0,
    );
    expect(compareRankableByCpl(result("REAL", 20_000), result("ZERO", undefined))).toBeLessThan(0);
  });

  it("treats two zero-lead angles as a tie (0) — original grouping order decides between them", () => {
    expect(compareRankableByCpl(result("ZERO_A", undefined), result("ZERO_B", undefined))).toBe(0);
  });
});

import { describe, expect, it } from "vitest";

import {
  MEDIUM_IMPRESSIONS_THRESHOLD,
  MEDIUM_LEADS_THRESHOLD,
} from "../../metric-snapshot/domain/data-sufficiency.js";
import type { InsightRow } from "../../metric-snapshot/infrastructure/metric-snapshot.repository.js";

import { rankAssetPerformance, type AssetPerformanceInput } from "./asset-performance.js";

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

function asset(
  packageId: string,
  insightRows: readonly InsightRow[],
  overrides: Partial<Omit<AssetPerformanceInput, "packageId" | "insightRows">> = {},
): AssetPerformanceInput {
  return {
    packageId,
    angle: "URGENCY",
    title: `Asset ${packageId}`,
    fatigueStatus: "NORMAL",
    hasVideo: false,
    imageCount: 3,
    insightRows,
    ...overrides,
  };
}

describe("rankAssetPerformance", () => {
  it("returns [] for empty input", () => {
    expect(rankAssetPerformance([])).toEqual([]);
  });

  it("reports a single asset with no rank when its data is INSUFFICIENT", () => {
    const results = rankAssetPerformance([asset("pkg-1", [row({ impressions: 10, leads: 0 })])]);
    expect(results).toHaveLength(1);
    expect(results[0]?.packageId).toBe("pkg-1");
    expect(results[0]?.dataSufficiency.level).toBe("INSUFFICIENT");
    expect(results[0]?.rank).toBeUndefined();
  });

  it("never groups two assets that happen to share the same angle — each keeps its own row", () => {
    const rowsA = highSufficiencyRows(10_000, MEDIUM_LEADS_THRESHOLD + 5);
    const rowsB = highSufficiencyRows(10_000, MEDIUM_LEADS_THRESHOLD + 5);
    const results = rankAssetPerformance([
      asset("pkg-1", rowsA, { angle: "URGENCY" }),
      asset("pkg-2", rowsB, { angle: "URGENCY" }),
    ]);
    expect(results).toHaveLength(2);
    const ids = results.map((r) => r.packageId).sort();
    expect(ids).toEqual(["pkg-1", "pkg-2"]);
  });

  it("ranks multiple sufficiently-sampled assets by real CPL ascending (1 = lowest CPL)", () => {
    const expensive = highSufficiencyRows(100_000, MEDIUM_LEADS_THRESHOLD + 5);
    const cheap = highSufficiencyRows(20_000, MEDIUM_LEADS_THRESHOLD + 5);
    const results = rankAssetPerformance([
      asset("pkg-expensive", expensive),
      asset("pkg-cheap", cheap),
    ]);

    const byId = new Map(results.map((r) => [r.packageId, r]));
    expect(byId.get("pkg-expensive")?.dataSufficiency.level).not.toBe("INSUFFICIENT");
    expect(byId.get("pkg-cheap")?.dataSufficiency.level).not.toBe("INSUFFICIENT");
    expect(byId.get("pkg-cheap")?.rank).toBe(1);
    expect(byId.get("pkg-expensive")?.rank).toBe(2);
    expect(results[0]?.packageId).toBe("pkg-cheap");
    expect(results[1]?.packageId).toBe("pkg-expensive");
  });

  it("excludes an asset with insufficient data from ranking, but still reports it (never silently dropped)", () => {
    const rankableRows = highSufficiencyRows(50_000, MEDIUM_LEADS_THRESHOLD + 5);
    const results = rankAssetPerformance([
      asset("pkg-rankable", rankableRows),
      asset("pkg-too-new", [row({ impressions: 50, leads: 0 })]),
    ]);
    const byId = new Map(results.map((r) => [r.packageId, r]));
    expect(byId.get("pkg-rankable")?.rank).toBe(1);
    expect(byId.get("pkg-too-new")?.rank).toBeUndefined();
    expect(byId.get("pkg-too-new")?.dataSufficiency.level).toBe("INSUFFICIENT");
    expect(results).toHaveLength(2);
  });

  it("assigns no ranks at all when every asset is below the MEDIUM data-sufficiency bar", () => {
    const results = rankAssetPerformance([
      asset("pkg-a", [row({ impressions: 10, leads: 0 })]),
      asset("pkg-b", [row({ impressions: 20, leads: 0 })]),
    ]);
    expect(results.every((r) => r.rank === undefined)).toBe(true);
    expect(results).toHaveLength(2);
  });

  it("a real asset with genuine zero leads never clears MEDIUM — reported, unranked, alongside a rankable one", () => {
    const zeroLeadHighVolume = highSufficiencyRows(50_000, 0).map((r) => ({
      ...r,
      impressions: MEDIUM_IMPRESSIONS_THRESHOLD,
      reach: MEDIUM_IMPRESSIONS_THRESHOLD,
      leads: 0,
    }));
    const realLeads = highSufficiencyRows(50_000, MEDIUM_LEADS_THRESHOLD + 1);
    const results = rankAssetPerformance([
      asset("pkg-zero", zeroLeadHighVolume),
      asset("pkg-real", realLeads),
    ]);
    const byId = new Map(results.map((r) => [r.packageId, r]));
    expect(byId.get("pkg-zero")?.aggregated.cpl).toBeUndefined();
    expect(byId.get("pkg-zero")?.dataSufficiency.level).toBe("LOW");
    expect(byId.get("pkg-zero")?.rank).toBeUndefined();
    expect(byId.get("pkg-real")?.rank).toBe(1);
  });

  it("carries through the real asset identity fields untouched (title, decidedFormat, fatigueStatus, hasVideo, imageCount)", () => {
    const results = rankAssetPerformance([
      asset("pkg-1", [row()], {
        title: "Rumah Minimalis BSD",
        decidedFormat: "VIDEO_AND_IMAGES",
        fatigueStatus: "WARNING",
        hasVideo: true,
        imageCount: 2,
      }),
    ]);
    expect(results[0]).toMatchObject({
      packageId: "pkg-1",
      title: "Rumah Minimalis BSD",
      decidedFormat: "VIDEO_AND_IMAGES",
      fatigueStatus: "WARNING",
      hasVideo: true,
      imageCount: 2,
    });
  });

  it("omits decidedFormat entirely (never a fabricated undefined-as-string) when the asset never carried one", () => {
    const results = rankAssetPerformance([asset("pkg-1", [row()])]);
    expect(results[0]).not.toHaveProperty("decidedFormat");
  });
});

import { describe, expect, it } from "vitest";

import type { MetricSnapshotDto } from "../dto/metric-snapshot.dto.js";

import { resolveBenchmark, type BenchmarkContext } from "./benchmark.js";
import type { DataSufficiencyResult } from "./data-sufficiency.js";

const CONTEXT: BenchmarkContext = { tenantId: "propertyklik-demo", campaignId: "cmp-1" };

function sufficiency(level: DataSufficiencyResult["level"]): DataSufficiencyResult {
  return { level, score: 0, reasons: [] };
}

function snapshot(overrides: Partial<MetricSnapshotDto> = {}): MetricSnapshotDto {
  return {
    window: "lifetime",
    spend: 1_000_000,
    impressions: 50_000,
    clicks: 500,
    reach: 40_000,
    leads: 25,
    ctr: 0.01,
    cpm: 20_000,
    cpc: 2_000,
    cpl: 40_000,
    frequency: 1.25,
    sampleSize: { impressions: 50_000, clicks: 500, leads: 25 },
    daysCovered: 30,
    dataSufficiency: sufficiency("HIGH"),
    ...overrides,
  };
}

describe("resolveBenchmark", () => {
  it("prefers CAMPAIGN_HISTORICAL when its own data sufficiency is HIGH", () => {
    const campaignHistorical = snapshot({
      cpl: 30_000,
      ctr: 0.02,
      dataSufficiency: sufficiency("HIGH"),
    });
    const accountHistorical = snapshot({
      cpl: 50_000,
      ctr: 0.008,
      dataSufficiency: sufficiency("HIGH"),
    });
    const result = resolveBenchmark(CONTEXT, { campaignHistorical, accountHistorical });
    expect(result).toEqual({
      source: "CAMPAIGN_HISTORICAL",
      cpl: 30_000,
      ctr: 0.02,
      confidence: "HIGH",
    });
  });

  it("prefers CAMPAIGN_HISTORICAL when its data sufficiency is exactly MEDIUM (the real usability floor)", () => {
    const campaignHistorical = snapshot({ dataSufficiency: sufficiency("MEDIUM") });
    const accountHistorical = snapshot({ dataSufficiency: sufficiency("HIGH") });
    const result = resolveBenchmark(CONTEXT, { campaignHistorical, accountHistorical });
    expect(result.source).toBe("CAMPAIGN_HISTORICAL");
    expect(result.confidence).toBe("MEDIUM");
  });

  it("falls through to ACCOUNT_HISTORICAL when campaign data sufficiency is LOW", () => {
    const campaignHistorical = snapshot({ dataSufficiency: sufficiency("LOW") });
    const accountHistorical = snapshot({
      cpl: 45_000,
      ctr: 0.009,
      dataSufficiency: sufficiency("HIGH"),
    });
    const result = resolveBenchmark(CONTEXT, { campaignHistorical, accountHistorical });
    expect(result).toEqual({
      source: "ACCOUNT_HISTORICAL",
      cpl: 45_000,
      ctr: 0.009,
      confidence: "HIGH",
    });
  });

  it("falls through to ACCOUNT_HISTORICAL when campaign data sufficiency is INSUFFICIENT", () => {
    const campaignHistorical = snapshot({ dataSufficiency: sufficiency("INSUFFICIENT") });
    const accountHistorical = snapshot({ dataSufficiency: sufficiency("MEDIUM") });
    const result = resolveBenchmark(CONTEXT, { campaignHistorical, accountHistorical });
    expect(result.source).toBe("ACCOUNT_HISTORICAL");
    expect(result.confidence).toBe("MEDIUM");
  });

  it("falls through to ACCOUNT_HISTORICAL when campaignHistorical is absent entirely", () => {
    const accountHistorical = snapshot({ dataSufficiency: sufficiency("HIGH") });
    const result = resolveBenchmark(CONTEXT, { accountHistorical });
    expect(result.source).toBe("ACCOUNT_HISTORICAL");
  });

  it("returns NONE with confidence NONE when neither source has enough data", () => {
    const campaignHistorical = snapshot({ dataSufficiency: sufficiency("LOW") });
    const accountHistorical = snapshot({ dataSufficiency: sufficiency("INSUFFICIENT") });
    const result = resolveBenchmark(CONTEXT, { campaignHistorical, accountHistorical });
    expect(result).toEqual({ source: "NONE", confidence: "NONE" });
    expect(result.cpl).toBeUndefined();
    expect(result.ctr).toBeUndefined();
  });

  it("returns NONE with confidence NONE when both sources are entirely absent", () => {
    const result = resolveBenchmark(CONTEXT, {});
    expect(result).toEqual({ source: "NONE", confidence: "NONE" });
  });

  it("returns NONE for an account-wide request (no campaignId) with insufficient account data", () => {
    const accountOnlyContext: BenchmarkContext = { tenantId: "propertyklik-demo" };
    const accountHistorical = snapshot({ dataSufficiency: sufficiency("LOW") });
    const result = resolveBenchmark(accountOnlyContext, { accountHistorical });
    expect(result).toEqual({ source: "NONE", confidence: "NONE" });
  });

  it("passes through undefined cpl/ctr from the chosen source honestly (never substitutes a number)", () => {
    const campaignHistorical = snapshot({
      cpl: undefined,
      ctr: undefined,
      leads: 0,
      dataSufficiency: sufficiency("MEDIUM"),
    });
    const result = resolveBenchmark(CONTEXT, { campaignHistorical });
    expect(result.source).toBe("CAMPAIGN_HISTORICAL");
    expect(result.cpl).toBeUndefined();
    expect(result.ctr).toBeUndefined();
  });
});

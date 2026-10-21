import { expect, it } from "vitest";
import {
  buildLeadFunnel,
  buildSamanthaLeadQualityAnalysis,
  leadQualityInsights,
  leadQualityTrend,
  MIN_LEAD_SAMPLE,
} from "@/lib/lead-quality";
import type { CampaignLead } from "@/lib/campaign-workspace";

function lead(overrides: Partial<CampaignLead> = {}): CampaignLead {
  return {
    id: overrides.id ?? "lead-1",
    status: overrides.status ?? "NEW",
    temperature: overrides.temperature ?? "COLD",
    score: overrides.score ?? 0,
    createdAt: overrides.createdAt ?? "2026-09-01T00:00:00Z",
    contacted: overrides.contacted ?? false,
    qualifiedAt: overrides.qualifiedAt,
  };
}

it("builds a real 4-stage funnel from leads, honest '—' for appointment/survey/booking", () => {
  const leads = [
    lead({ id: "1", contacted: true, temperature: "HOT" }),
    lead({ id: "2", contacted: true, temperature: "WARM" }),
    lead({ id: "3", contacted: false, temperature: "COLD" }),
    lead({ id: "4", contacted: false, temperature: "COLD" }),
  ];
  const funnel = buildLeadFunnel(leads);
  expect(funnel.map((s) => [s.key, s.value])).toEqual([
    ["raw", 4],
    ["contacted", 2],
    ["qualified", 2],
    ["hot", 1],
    ["appointment", undefined],
    ["survey", undefined],
    ["booking", undefined],
  ]);
  // Real drop-off math: contacted (2) vs raw (4) => 50% drop-off.
  expect(funnel.find((s) => s.key === "contacted")?.dropOffPct).toBe(50);
  // qualified (2) vs contacted (2) => 0% drop-off, not undefined.
  expect(funnel.find((s) => s.key === "qualified")?.dropOffPct).toBe(0);
  // hot (1) vs qualified (2) => 50% drop-off.
  expect(funnel.find((s) => s.key === "hot")?.dropOffPct).toBe(50);
  // Honest gap stages never get a fabricated drop-off number.
  expect(funnel.find((s) => s.key === "appointment")?.dropOffPct).toBeUndefined();
  expect(funnel.find((s) => s.key === "survey")?.dropOffPct).toBeUndefined();
  expect(funnel.find((s) => s.key === "booking")?.dropOffPct).toBeUndefined();
});

it("returns every stage undefined (never a fabricated zero) when leads is undefined", () => {
  const funnel = buildLeadFunnel(undefined);
  expect(funnel.every((s) => s.value === undefined)).toBe(true);
});

it("derives INSUFFICIENT_DATA when leads is empty or below the real sample floor", () => {
  expect(buildSamanthaLeadQualityAnalysis(undefined).posture).toBe("INSUFFICIENT_DATA");
  expect(buildSamanthaLeadQualityAnalysis([]).posture).toBe("INSUFFICIENT_DATA");
  const tooFew = Array.from({ length: MIN_LEAD_SAMPLE - 1 }, (_, i) =>
    lead({ id: String(i), contacted: true, temperature: "HOT" }),
  );
  expect(buildSamanthaLeadQualityAnalysis(tooFew).posture).toBe("INSUFFICIENT_DATA");
});

it("derives a real posture purely from contacted/hot rates, never an invented numeric score", () => {
  const strong = Array.from({ length: 10 }, (_, i) =>
    lead({ id: String(i), contacted: i < 9, temperature: i < 4 ? "HOT" : "WARM" }),
  );
  const analysis = buildSamanthaLeadQualityAnalysis(strong);
  expect(analysis.posture).toBe("EXCELLENT");
  expect(Object.keys(analysis)).toEqual([
    "posture",
    "summary",
    "recommendation",
    "keyInsights",
    "trackingCaveat",
  ]);
  const poor = Array.from({ length: 10 }, (_, i) =>
    lead({ id: String(i), contacted: false, temperature: "COLD" }),
  );
  expect(buildSamanthaLeadQualityAnalysis(poor).posture).toBe("POOR");
});

it("always attaches the real CPQL/appointment/booking tracking caveat, regardless of posture", () => {
  const strong = Array.from({ length: 10 }, (_, i) =>
    lead({ id: String(i), contacted: true, temperature: "HOT" }),
  );
  const analysis = buildSamanthaLeadQualityAnalysis(strong);
  expect(analysis.trackingCaveat).toMatch(/CPQL/);
  expect(analysis.trackingCaveat).toMatch(/Respon Pintar/);
});

it("groups real raw and qualified leads per day, and skips hot rate for days with zero raw leads", () => {
  const leads = [
    lead({
      id: "1",
      createdAt: "2026-09-01T00:00:00Z",
      temperature: "HOT",
      qualifiedAt: "2026-09-02T00:00:00Z",
    }),
    lead({ id: "2", createdAt: "2026-09-01T00:00:00Z", temperature: "COLD" }),
    lead({ id: "3", createdAt: "2026-09-03T00:00:00Z", temperature: "COLD" }),
  ];
  const trend = leadQualityTrend(leads);
  expect(trend.days).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
  expect(trend.rawByDay).toEqual([2, 0, 1]);
  expect(trend.qualifiedByDay).toEqual([0, 1, 0]);
  // 2026-09-02 has a qualified/hot event but zero raw leads created that day => undefined, not 0.
  expect(trend.hotRateByDay[1]).toBeUndefined();
  expect(trend.hotRateByDay[0]).toBe(0);
});

it("gates lead quality insights by the real sample floor, never a placeholder insight", () => {
  expect(leadQualityInsights(undefined)).toEqual([]);
  const tooFew = Array.from({ length: MIN_LEAD_SAMPLE - 1 }, (_, i) => lead({ id: String(i) }));
  expect(leadQualityInsights(tooFew)).toEqual([]);
  const enough = Array.from({ length: MIN_LEAD_SAMPLE }, (_, i) =>
    lead({
      id: String(i),
      contacted: i < 3,
      createdAt: "2026-09-01T00:00:00Z",
      qualifiedAt: i < 2 ? "2026-09-02T00:00:00Z" : undefined,
    }),
  );
  const insights = leadQualityInsights(enough);
  expect(insights[0]).toMatch(/dikontak/);
  expect(insights.find((i) => i.includes("Median"))).toMatch(/1\.0 hari/);
});

import { describe, expect, it } from "vitest";
import type { StressTestEvaluatedResultDto, StressTestRunDto } from "@/lib/stress-test";
import { compareSimulationRuns } from "@/lib/simulation-compare";
function persona(
  personaId: StressTestEvaluatedResultDto["personaCritiques"][number]["personaId"],
  personaLabel: string,
  objections: { objection: string; severity: "HIGH" | "MEDIUM" | "LOW" }[],
): StressTestEvaluatedResultDto["personaCritiques"][number] {
  return {
    personaId,
    personaLabel,
    ok: true,
    critique: {
      simulated: true,
      attracts: ["Lokasi strategis", "Dekat tol"],
      confusions: [],
      objections,
      intentDrivers: ["Promo DP"],
      narrativeReaction: "Reaksi.",
    },
  };
}

const RESULT: StressTestEvaluatedResultDto = {
  kind: "COMPLETED",
  personaCritiques: [
    persona("PRICE_SENSITIVE", "Price Sensitive", [
      { objection: "Harga terlalu tinggi", severity: "MEDIUM" },
      { objection: "DP tidak disebut", severity: "LOW" },
    ]),
    persona("SKEPTICAL_BUYER", "Skeptical Buyer", [
      { objection: "  harga TERLALU tinggi. ", severity: "HIGH" },
      { objection: "Legalitas belum jelas", severity: "HIGH" },
    ]),
    persona("INVESTOR", "Investor", [{ objection: "Harga terlalu tinggi!", severity: "LOW" }]),
    {
      personaId: "FAMILY_BUYER",
      personaLabel: "Family Buyer",
      ok: false,
      failureReason: "PROVIDER_ERROR: boom",
    },
  ],
  copyEvaluation: {
    ok: true,
    hookClarity: { status: "STRONG", reasoning: "Hook kuat." },
    offerStrength: { status: "ADEQUATE", reasoning: "Offer kurang spesifik." },
    ctaSpecificity: { status: "WEAK", reasoning: "Tidak ada CTA." },
    internalConsistency: { status: "WEAK", reasoning: "Harga di headline dan body berbeda." },
  },
  factCheck: {
    status: "CHECKED",
    note: "Diperiksa.",
    findings: [
      { claim: "SHM", status: "SUPPORTED", reasoning: "Sesuai dokumen." },
      { claim: "5 menit ke tol", status: "UNSUPPORTED_CLAIM", reasoning: "Tidak ada di dokumen." },
      { claim: "Luas 200m2", status: "CONFLICTING_CLAIM", reasoning: "Dokumen menyebut 120m2." },
    ],
  },
  dimensionScores: [
    { dimension: "HOOK", score: 90 },
    { dimension: "OFFER", score: 65 },
    { dimension: "CTA", score: 35 },
    { dimension: "OBJECTION_HANDLING", score: 62 },
  ],
  overallScore: 63,
  scoreBucket: "NEEDS_REVISION",
  confidence: 75,
  primaryRecommendation: "Prioritas utama: klaim bertentangan.",
  evaluatorsAttempted: 5,
  evaluatorsSucceeded: 4,
  gaps: [],
};

function run(id: string, overrides: Partial<StressTestRunDto> = {}): StressTestRunDto {
  return {
    id,
    name: id,
    sourceType: "LISTING",
    listingId: "listing-1",
    creativeIds: ["photo-1"],
    mode: "STANDARD",
    primaryGoal: "CPQL",
    personaIds: ["INVESTOR"],
    objectionSources: [],
    status: "COMPLETED",
    result: structuredClone(RESULT),
    createdAt: "2026-09-28T00:00:00Z",
    ...overrides,
  };
}
describe("comparison safety and evidence", () => {
  it("calculates B minus A, keeps regressions and missing dimensions", () => {
    const b = {
      ...RESULT,
      overallScore: 80,
      dimensionScores: [{ dimension: "HOOK" as const, score: 70 }],
    };
    const data = compareSimulationRuns(run("a"), run("b", { result: b }));
    expect(data.overallDelta).toBe(17);
    expect(data.regressions[0]?.delta).toBe(-20);
    expect(data.dimensions.find((d) => d.label === "Visual Relevance")?.delta).toBeNull();
  });
  it("blocks changed goals and unrelated assets", () => {
    expect(
      compareSimulationRuns(run("a"), run("b", { primaryGoal: "HOT_LEAD_RATE" })).overallDelta,
    ).toBeNull();
    expect(
      compareSimulationRuns(run("a"), run("b", { listingId: "other", creativeIds: ["other"] }))
        .comparability.blocked,
    ).toBe(true);
  });
  it("does not interpret disappearance as resolution", () => {
    const b = { ...RESULT, personaCritiques: [] };
    const data = compareSimulationRuns(run("a"), run("b", { result: b }));
    expect(data.objections.every((o) => o.status === "Tidak muncul di Run B")).toBe(true);
    expect(data.summaryB.resolved).toBeNull();
  });
  it("matches normalized exact text and preserves the source runs", () => {
    const a = run("a"),
      b = run("b"),
      before = JSON.stringify([a, b]);
    const data = compareSimulationRuns(a, b);
    expect(data.objections).toHaveLength(3);
    expect(data.objections[0]?.a?.personaCount).toBe(3);
    expect(JSON.stringify([a, b])).toBe(before);
  });
  it("flags new claim risks even when overall score rises", () => {
    const b = {
      ...RESULT,
      overallScore: 90,
      factCheck: {
        ...RESULT.factCheck,
        findings: [
          ...RESULT.factCheck.findings,
          { claim: "DP 0%", status: "UNSUPPORTED_CLAIM" as const, reasoning: "No source" },
        ],
      },
    };
    const data = compareSimulationRuns(run("a"), run("b", { result: b }));
    expect(data.overallDelta).toBe(27);
    expect(data.newClaimRisks.map((c) => c.claim)).toEqual(["DP 0%"]);
  });
  it("keeps unverified facts and unfinished scores unknown", () => {
    const b = {
      ...RESULT,
      factCheck: { status: "FAILED" as const, note: "Unavailable", findings: [] },
    };
    expect(compareSimulationRuns(run("a"), run("b", { result: b })).factsB).toBeNull();
    expect(
      compareSimulationRuns(run("a"), run("b", { status: "RUNNING", result: null })).overallDelta,
    ).toBeNull();
  });
});

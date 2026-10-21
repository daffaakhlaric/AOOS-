import { describe, expect, it } from "vitest";
import type {
  StressTestEvaluatedResultDto,
  StressTestObjectionResolutionResultDto,
  StressTestPartialResultDto,
  StressTestPersonaAttemptDto,
  StressTestRunDto,
  StressTestRunProgressDto,
} from "@/lib/stress-test";
import {
  mapObjectionDetail,
  mapObjectionFilters,
  mapObjectionRows,
  objectionsToCsv,
  sortObjectionRows,
} from "@/lib/stress-test-objections";
import { mapSimulationRunListItem } from "@/lib/stress-test-history";
import {
  partialAsEvaluatedView,
  partialResultOf,
  progressOf,
  shouldPollRuns,
  summarizeProgress,
} from "@/lib/stress-test-progress";
import { computeEvaluatorCoverage, normalizeObjectionText } from "@/lib/stress-test-result";

function persona(
  id: StressTestPersonaAttemptDto["personaId"],
  label: string,
  objections: { objection: string; severity: "HIGH" | "MEDIUM" | "LOW" }[],
): StressTestPersonaAttemptDto {
  return {
    personaId: id,
    personaLabel: label,
    ok: true,
    critique: {
      simulated: true,
      attracts: [],
      confusions: [],
      objections,
      intentDrivers: [],
      narrativeReaction: "x",
    },
  };
}

const BASE_RESULT: StressTestEvaluatedResultDto = {
  kind: "COMPLETED",
  personaCritiques: [
    persona("PRICE_SENSITIVE", "Price Sensitive", [
      { objection: "Harga terlalu tinggi", severity: "MEDIUM" },
      { objection: "Cicilan KPR tidak disebut", severity: "MEDIUM" },
    ]),
    persona("SKEPTICAL_BUYER", "Skeptical Buyer", [
      { objection: "Sertifikat belum jelas", severity: "HIGH" },
      { objection: "Lokasi banjir?", severity: "LOW" },
    ]),
  ],
  copyEvaluation: { ok: true },
  factCheck: { status: "NOT_APPLICABLE", note: "n/a", findings: [] },
  dimensionScores: [],
  overallScore: 60,
  scoreBucket: "NEEDS_REVISION",
  confidence: 85,
  primaryRecommendation: "x",
  evaluatorsAttempted: 4,
  evaluatorsSucceeded: 4,
  gaps: [],
};

const ASSESSED: StressTestObjectionResolutionResultDto = {
  status: "ASSESSED",
  simulated: true,
  note: "Penilaian AI",
  items: [
    {
      key: "harga terlalu tinggi",
      objection: "Harga terlalu tinggi",
      resolutionStatus: "PARTIAL",
      goalImpact: "HIGH",
      shortRecommendation: "Tambahkan harga per meter.",
      evidence: "Harga Rp 1,5 M",
    },
    {
      key: "cicilan kpr tidak disebut",
      objection: "Cicilan KPR tidak disebut",
      resolutionStatus: "REQUIRES_KNOWLEDGE",
      goalImpact: "VERY_HIGH",
      shortRecommendation: "Butuh data: skema KPR/cicilan",
      evidence: null,
      adjustment: "UNGROUNDED_TERM",
    },
    {
      key: "sertifikat belum jelas",
      objection: "Sertifikat belum jelas",
      resolutionStatus: "RESOLVED",
      goalImpact: "MEDIUM",
      shortRecommendation: "Pertahankan SHM.",
      evidence: "SHM",
    },
  ],
};

const WITH_RESOLUTION: StressTestEvaluatedResultDto = {
  ...BASE_RESULT,
  objectionResolution: ASSESSED,
};

describe("objection rows from the real Objection Resolution evaluator", () => {
  it("maps status badges, AI impact, recommendation and evidence by normalized key; unmatched rows stay 'Belum dinilai'", () => {
    const { rows } = mapObjectionRows(WITH_RESOLUTION);
    const byKey = new Map(rows.map((r) => [r.key, r]));
    expect(byKey.get("harga terlalu tinggi")).toMatchObject({
      resolution: "PARTIAL",
      resolutionLabel: "Sebagian Terjawab",
      impact: "HIGH",
      impactLabel: "Tinggi",
      recommendation: "Tambahkan harga per meter.",
      evidence: "Harga Rp 1,5 M",
    });
    expect(byKey.get("cicilan kpr tidak disebut")).toMatchObject({
      resolutionLabel: "Butuh Knowledge",
      impactLabel: "Sangat Tinggi",
      adjustment: "UNGROUNDED_TERM",
    });
    expect(byKey.get("cicilan kpr tidak disebut")?.evidence).toBeUndefined();
    expect(byKey.get("sertifikat belum jelas")?.resolutionLabel).toBe("Sudah Terjawab");
    const unmatched = byKey.get(normalizeObjectionText("Lokasi banjir?"));
    expect(unmatched?.resolution).toBe("NOT_ASSESSED");
    expect(unmatched?.resolutionLabel).toBe("Belum dinilai");
    expect(unmatched?.impact).toBeUndefined();
    expect(unmatched?.recommendation).toBeUndefined();
  });

  it("maps the remaining status labels", () => {
    const labels = (["UNRESOLVED", "REQUIRES_SALES", "NOT_SOLVABLE_IN_CREATIVE"] as const).map(
      (status) => {
        const r = mapObjectionRows({
          ...BASE_RESULT,
          objectionResolution: {
            ...ASSESSED,
            items: [{ ...ASSESSED.items[0]!, resolutionStatus: status, goalImpact: "LOW" }],
          },
        }).rows.find((row) => row.key === "harga terlalu tinggi");
        return [r?.resolutionLabel, r?.impactLabel];
      },
    );
    expect(labels).toEqual([
      ["Belum Terjawab", "Rendah"],
      ["Butuh Sales Follow-up", "Rendah"],
      ["Bukan Masalah Creative", "Rendah"],
    ]);
  });

  it("old runs (no objectionResolution) and FAILED/SKIPPED evaluators keep every row 'Belum dinilai'", () => {
    for (const result of [
      BASE_RESULT,
      { ...BASE_RESULT, objectionResolution: { ...ASSESSED, status: "FAILED" as const } },
      { ...BASE_RESULT, objectionResolution: { ...ASSESSED, status: "SKIPPED" as const } },
    ]) {
      const { rows } = mapObjectionRows(result);
      expect(rows.every((r) => r.resolution === "NOT_ASSESSED" && r.impact === undefined)).toBe(
        true,
      );
      expect(mapObjectionFilters(rows).resolutionNotAssessed).toBe(true);
      expect(mapObjectionFilters(rows).tabs.some((t) => t.id.startsWith("RES_"))).toBe(false);
    }
  });

  it("resolution tabs appear from real counts only (Unresolved/Partial/Resolved + Butuh Knowledge/Sales when > 0)", () => {
    const { rows } = mapObjectionRows(WITH_RESOLUTION);
    const opts = mapObjectionFilters(rows);
    expect(opts.resolutionNotAssessed).toBe(false);
    expect(opts.tabs.filter((t) => t.id.startsWith("RES_")).map((t) => [t.label, t.count])).toEqual(
      [
        ["Partial", 1],
        ["Resolved", 1],
        ["Butuh Knowledge", 1],
      ],
    );
  });

  it("CSV carries the real impact / resolution / recommendation values", () => {
    const { rows } = mapObjectionRows(WITH_RESOLUTION);
    const csv = objectionsToCsv(rows.filter((r) => r.key === "harga terlalu tinggi"));
    expect(csv.split("\r\n")[1]).toContain(",HIGH,PARTIAL,Tambahkan harga per meter.,SIMULATION");
  });

  it("PRIORITY sort: severity -> agreement -> AI impact -> open resolution first", () => {
    const { rows } = mapObjectionRows(WITH_RESOLUTION);
    // Both MEDIUM / 1 persona: VERY_HIGH impact (KPR) outranks HIGH (harga).
    const medium = sortObjectionRows(rows, "PRIORITY")
      .filter((r) => r.severity === "MEDIUM")
      .map((r) => r.key);
    expect(medium).toEqual(["cicilan kpr tidak disebut", "harga terlalu tinggi"]);
    expect(sortObjectionRows(rows, "PRIORITY")[0]?.key).toBe("sertifikat belum jelas"); // HIGH severity first
  });

  it("drawer detail flags assessed rows and needs-knowledge from the AI status", () => {
    const { rows } = mapObjectionRows({
      ...WITH_RESOLUTION,
      factCheck: { status: "CHECKED", note: "", findings: [] },
    });
    const kpr = rows.find((r) => r.key === "cicilan kpr tidak disebut")!;
    const detail = mapObjectionDetail(kpr, {
      ...WITH_RESOLUTION,
      factCheck: { status: "CHECKED", note: "", findings: [] },
    });
    expect(detail.assessed).toBe(true);
    expect(detail.needsKnowledge).toBe(true);
  });

  it("evaluator coverage counts Objection Resolution only when it was actually called", () => {
    expect(
      computeEvaluatorCoverage(BASE_RESULT).rows.find(
        (r) => r.label === "Objection Resolution (AI)",
      )?.state,
    ).toBe("NOT_RUN");
    const cov = computeEvaluatorCoverage(WITH_RESOLUTION);
    expect(cov.rows.find((r) => r.label === "Objection Resolution (AI)")?.state).toBe("SUCCEEDED");
    expect(cov.attempted).toBe(computeEvaluatorCoverage(BASE_RESULT).attempted + 1);
  });
});

/* ---------------------------------------------------------------------------------------------- */

const RUN_BASE: StressTestRunDto = {
  id: "run-1",
  name: "Run 1",
  sourceType: "CAMPAIGN",
  campaignId: "cmp-1",
  creativeIds: [],
  mode: "STANDARD",
  primaryGoal: "CPQL",
  personaIds: ["PRICE_SENSITIVE"],
  objectionSources: [],
  status: "COMPLETED",
  result: WITH_RESOLUTION,
  createdAt: "2026-09-28T00:00:00.000Z",
};

const CTX = {
  listings: new Map(),
  personaLabels: new Map<string, string>(),
  nowMs: Date.parse("2026-09-28T01:00:00.000Z"),
};

const PROGRESS: StressTestRunProgressDto = {
  updatedAt: "2026-09-28T00:00:10.000Z",
  steps: [
    { key: "PERSONA_SIMULATION", state: "RUNNING", done: 3, total: 5, failed: 0 },
    { key: "COPY_EVALUATION", state: "DONE" },
    { key: "FACT_VALIDATION", state: "RUNNING" },
    { key: "OBJECTION_RESOLUTION", state: "PENDING" },
  ],
};

describe("history list item", () => {
  it("maps campaignId -> real campaign name for the Context column, '—' (undefined) when not found", () => {
    const names = new Map([["cmp-1", "Promo Bintaro Q3"]]);
    expect(mapSimulationRunListItem(RUN_BASE, { ...CTX, campaignNames: names }).contextTitle).toBe(
      "Promo Bintaro Q3",
    );
    expect(
      mapSimulationRunListItem(
        { ...RUN_BASE, campaignId: "other" },
        { ...CTX, campaignNames: names },
      ).contextTitle,
    ).toBeUndefined();
    expect(
      mapSimulationRunListItem(RUN_BASE, { ...CTX, campaignsLoading: true }).contextLoading,
    ).toBe(true);
    expect(mapSimulationRunListItem(RUN_BASE, CTX).contextLoading).toBe(false);
  });

  it("objection cell: 'x belum terjawab · y sebagian' counts only when the evaluator assessed the run", () => {
    const withUnresolved: StressTestRunDto = {
      ...RUN_BASE,
      result: {
        ...WITH_RESOLUTION,
        objectionResolution: {
          ...ASSESSED,
          items: [
            ...ASSESSED.items,
            { ...ASSESSED.items[0]!, key: "lokasi banjir", resolutionStatus: "UNRESOLVED" },
          ],
        },
      },
    };
    expect(mapSimulationRunListItem(withUnresolved, CTX).objections?.resolution).toEqual({
      unresolved: 1,
      partial: 1,
    });
    expect(mapSimulationRunListItem({ ...RUN_BASE, result: BASE_RESULT }, CTX).objections).toEqual({
      total: 4,
      unique: 4,
    });
  });

  it("RUNNING run exposes the real persisted progress; legacy RUNNING without it exposes none", () => {
    const running = mapSimulationRunListItem(
      { ...RUN_BASE, status: "RUNNING", result: { kind: "IN_PROGRESS", progress: PROGRESS } },
      CTX,
    );
    expect(running.inProgress).toBe(true);
    expect(running.progress?.text).toBe(
      "Persona 3/5 berjalan, Copy ✓, Fact berjalan, Resolusi menunggu — 1/4 evaluator",
    );
    const legacy = mapSimulationRunListItem({ ...RUN_BASE, status: "RUNNING", result: null }, CTX);
    expect(legacy.progress).toBeUndefined();
  });

  it("FAILED run offers a partial result only when it has real output", () => {
    const partial: StressTestPartialResultDto = {
      kind: "PARTIAL",
      partial: true,
      hasRealOutput: true,
      personaCritiques: BASE_RESULT.personaCritiques,
      evaluatorsAttempted: 3,
      evaluatorsSucceeded: 2,
      gaps: [],
      progress: PROGRESS,
    };
    const item = mapSimulationRunListItem({ ...RUN_BASE, status: "FAILED", result: partial }, CTX);
    expect(item.hasPartialResult).toBe(true);
    expect(item.score).toBeUndefined();
    expect(item.bucket).toBeUndefined();
    expect(
      mapSimulationRunListItem(
        { ...RUN_BASE, status: "FAILED", result: { ...partial, hasRealOutput: false } },
        CTX,
      ).hasPartialResult,
    ).toBe(false);
  });
});

describe("progress + partial helpers", () => {
  it("summarizes settled steps and polls only while a run is QUEUED/RUNNING", () => {
    const done = summarizeProgress({
      ...PROGRESS,
      steps: PROGRESS.steps.map((s) => ({
        ...s,
        state: s.key === "FACT_VALIDATION" ? ("SKIPPED" as const) : ("DONE" as const),
      })),
    });
    expect(done.settled).toBe(4);
    expect(done.text).toBe("Persona 3/5 ✓, Copy ✓, Fact –, Resolusi ✓ — 4/4 evaluator");
    expect(shouldPollRuns([{ status: "COMPLETED" }, { status: "FAILED" }])).toBe(false);
    expect(shouldPollRuns([{ status: "COMPLETED" }, { status: "QUEUED" }])).toBe(true);
    expect(progressOf({ ...RUN_BASE, result: null })).toBeUndefined();
  });

  it("partial view never carries a score/bucket and fills missing evaluators with honest 'not finished' failures", () => {
    const partial: StressTestPartialResultDto = {
      kind: "PARTIAL",
      partial: true,
      hasRealOutput: true,
      personaCritiques: BASE_RESULT.personaCritiques,
      evaluatorsAttempted: 3,
      evaluatorsSucceeded: 2,
      gaps: ["x"],
      progress: PROGRESS,
    };
    expect(partialResultOf({ ...RUN_BASE, status: "FAILED", result: partial })).toBe(partial);
    expect(partialResultOf({ ...RUN_BASE, status: "COMPLETED", result: partial })).toBeUndefined();
    const view = partialAsEvaluatedView(partial);
    expect(view.overallScore).toBeNull();
    expect(view.scoreBucket).toBeNull();
    expect(view.dimensionScores).toEqual([]);
    expect(view.copyEvaluation.ok).toBe(false);
    expect(view.factCheck.status).toBe("FAILED");
  });
});

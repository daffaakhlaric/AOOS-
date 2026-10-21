import { describe, expect, it } from "vitest";

import { groupSimulatedObjections, normalizeObjectionText } from "./objection-grouping.js";
import {
  EVIDENCE_NOT_FOUND_RECOMMENDATION,
  MAX_RECOMMENDATION_LENGTH,
  findUngroundedTerm,
  verifyObjectionAssessments,
  type RawObjectionAssessment,
} from "./objection-resolution.js";
import { StressTestProgressTracker } from "./stress-test-progress.js";
import type { StressTestPersonaAttempt, StressTestRunProgress } from "./stress-test-run.js";

const CREATIVE_TEXT =
  "Rumah Bintaro 2 Lantai\nHarga: Rp 1.500.000.000\nRumah nyaman dekat stasiun, sertifikat SHM.";

const OBJECTIONS = [
  {
    key: "legalitas belum jelas",
    objection: "Legalitas belum jelas",
    severity: "HIGH" as const,
    personaLabels: ["Skeptical Buyer"],
  },
  {
    key: "harga dirasa tinggi",
    objection: "Harga dirasa tinggi",
    severity: "MEDIUM" as const,
    personaLabels: ["Price Sensitive"],
  },
];

function raw(overrides: Partial<RawObjectionAssessment> = {}): RawObjectionAssessment {
  return {
    id: "o1",
    resolutionStatus: "RESOLVED",
    goalImpact: "HIGH",
    shortRecommendation: "Pertahankan penyebutan SHM.",
    evidence: "sertifikat SHM",
    ...overrides,
  };
}

function verify(assessments: readonly RawObjectionAssessment[], groundingText = CREATIVE_TEXT) {
  return verifyObjectionAssessments({
    objections: OBJECTIONS,
    assessments,
    creativeText: CREATIVE_TEXT,
    groundingText,
  });
}

describe("normalizeObjectionText / groupSimulatedObjections", () => {
  it("normalizes case, whitespace, surrounding quotes and trailing punctuation (same rule as the dashboard)", () => {
    expect(normalizeObjectionText('  "Harga   Dirasa TINGGI!"  ')).toBe("harga dirasa tinggi");
    expect(normalizeObjectionText("“Legalitas belum jelas.”")).toBe("legalitas belum jelas");
  });

  it("groups by normalized text across successful personas only, keeping each persona's highest severity", () => {
    const attempts: StressTestPersonaAttempt[] = [
      {
        personaId: "PRICE_SENSITIVE",
        personaLabel: "Price Sensitive",
        ok: true,
        critique: {
          simulated: true,
          attracts: ["x"],
          confusions: [],
          objections: [
            { objection: "Harga dirasa tinggi.", severity: "LOW" },
            { objection: "harga dirasa tinggi", severity: "HIGH" },
          ],
          intentDrivers: [],
          narrativeReaction: "n",
        },
      },
      {
        personaId: "INVESTOR",
        personaLabel: "Investor",
        ok: true,
        critique: {
          simulated: true,
          attracts: ["x"],
          confusions: [],
          objections: [{ objection: "Harga Dirasa Tinggi", severity: "MEDIUM" }],
          intentDrivers: [],
          narrativeReaction: "n",
        },
      },
      { personaId: "HIGH_INTENT", personaLabel: "High Intent", ok: false, failureReason: "boom" },
    ];
    const groups = groupSimulatedObjections(attempts);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual({
      key: "harga dirasa tinggi",
      objection: "Harga dirasa tinggi.",
      severity: "HIGH",
      personaLabels: ["Price Sensitive", "Investor"],
    });
  });
});

describe("verifyObjectionAssessments", () => {
  it("keeps RESOLVED when the evidence quote literally exists in the creative text (case/whitespace-insensitive)", () => {
    const [item] = verify([raw({ evidence: "Sertifikat   shm." })]);
    expect(item?.resolutionStatus).toBe("RESOLVED");
    expect(item?.evidence).toBe("Sertifikat   shm.");
    expect(item?.key).toBe("legalitas belum jelas");
    expect(item?.adjustment).toBeUndefined();
  });

  it("downgrades RESOLVED/PARTIAL to UNRESOLVED and drops the evidence when the quote is not a substring of the creative text", () => {
    const items = verify([
      raw({ evidence: "Sertifikat SHM sudah balik nama" }),
      raw({ id: "o2", resolutionStatus: "PARTIAL", evidence: null }),
    ]);
    expect(items.map((i) => i.resolutionStatus)).toEqual(["UNRESOLVED", "UNRESOLVED"]);
    expect(items.every((i) => i.evidence === null)).toBe(true);
    expect(items.every((i) => i.adjustment === "EVIDENCE_NOT_FOUND")).toBe(true);
    expect(items[0]?.shortRecommendation).toBe(EVIDENCE_NOT_FOUND_RECOMMENDATION);
  });

  it("rejects trivially short evidence quotes", () => {
    const [item] = verify([raw({ evidence: "SH" })]);
    expect(item?.resolutionStatus).toBe("UNRESOLVED");
  });

  it("turns an UNRESOLVED recommendation that invents an ungrounded promo/KPR term into REQUIRES_KNOWLEDGE with a 'Butuh data:' recommendation", () => {
    const [item] = verify([
      raw({
        id: "o2",
        resolutionStatus: "UNRESOLVED",
        evidence: null,
        shortRecommendation: "Tambahkan diskon 10% untuk pembeli pertama",
      }),
    ]);
    expect(item?.resolutionStatus).toBe("REQUIRES_KNOWLEDGE");
    expect(item?.adjustment).toBe("UNGROUNDED_TERM");
    expect(item?.shortRecommendation).toMatch(/^Butuh data: detail diskon\/promo/);
  });

  it("does NOT flag a term that genuinely exists in the grounding facts", () => {
    const [item] = verify(
      [
        raw({
          id: "o2",
          resolutionStatus: "UNRESOLVED",
          evidence: null,
          shortRecommendation: "Sebutkan promo DP yang berlaku",
        }),
      ],
      `${CREATIVE_TEXT}\npromo DP 0% berlaku sampai Desember`,
    );
    expect(item?.resolutionStatus).toBe("UNRESOLVED");
    expect(item?.adjustment).toBeUndefined();
  });

  it("prefixes 'Butuh data:' on REQUIRES_KNOWLEDGE recommendations and caps the length", () => {
    const long =
      "jarak pasti ke stasiun terdekat dan rute angkutan umum yang tersedia dari lokasi perumahan ini setiap hari kerja";
    const [item] = verify([
      raw({ resolutionStatus: "REQUIRES_KNOWLEDGE", evidence: null, shortRecommendation: long }),
    ]);
    expect(item?.shortRecommendation.startsWith("Butuh data: ")).toBe(true);
    expect(item?.shortRecommendation.length).toBeLessThanOrEqual(MAX_RECOMMENDATION_LENGTH);
    expect(item?.shortRecommendation.endsWith("…")).toBe(true);
  });

  it("ignores unknown ids and duplicate assessments (first wins); skipped objections get no item", () => {
    const items = verify([
      raw({ id: "o9" }),
      raw(),
      raw({ resolutionStatus: "REQUIRES_SALES", evidence: null }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]?.resolutionStatus).toBe("RESOLVED");
  });

  it("findUngroundedTerm matches at a word start only", () => {
    expect(findUngroundedTerm("Jelaskan skema KPR", "")).toBe("skema KPR/cicilan");
    expect(findUngroundedTerm("Perjelas lokasi", "")).toBeUndefined();
  });
});

describe("StressTestProgressTracker", () => {
  it("persists one serialized write per state change, each with the latest snapshot, and reaches DONE/FAILED per persona outcome", async () => {
    const writes: StressTestRunProgress[] = [];
    const tracker = new StressTestProgressTracker(
      2,
      async (p) => {
        await new Promise((r) => setTimeout(r, 1));
        writes.push(p);
      },
      () => new Date("2026-09-28T00:00:00.000Z"),
    );
    expect(tracker.snapshot().steps.map((s) => s.state)).toEqual([
      "RUNNING",
      "RUNNING",
      "RUNNING",
      "PENDING",
    ]);
    tracker.personaSettled(true);
    tracker.personaSettled(false);
    tracker.set("COPY_EVALUATION", "DONE");
    await tracker.flush();
    expect(writes).toHaveLength(3);
    const last = writes[2];
    expect(last?.steps[0]).toMatchObject({
      key: "PERSONA_SIMULATION",
      state: "DONE",
      done: 2,
      total: 2,
      failed: 1,
    });
    expect(last?.steps[1]?.state).toBe("DONE");
  });

  it("marks the persona step FAILED when every persona failed, and finalSnapshot fails RUNNING / skips PENDING steps", async () => {
    const tracker = new StressTestProgressTracker(
      1,
      async () => undefined,
      () => new Date(),
    );
    tracker.personaSettled(false);
    await tracker.flush();
    expect(tracker.snapshot().steps[0]?.state).toBe("FAILED");
    const final = tracker.finalSnapshot().steps.map((s) => s.state);
    expect(final).toEqual(["FAILED", "FAILED", "FAILED", "SKIPPED"]);
  });

  it("a failing progress write never throws out of the tracker", async () => {
    const errors: unknown[] = [];
    const tracker = new StressTestProgressTracker(
      1,
      async () => {
        throw new Error("db down");
      },
      () => new Date(),
      (e) => errors.push(e),
    );
    tracker.set("COPY_EVALUATION", "DONE");
    await expect(tracker.flush()).resolves.toBeUndefined();
    expect(errors).toHaveLength(1);
  });
});

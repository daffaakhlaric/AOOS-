import { describe, expect, it } from "vitest";

import {
  computeSimulationScoring,
  scoreClara,
  scoreKaiAvailability,
  scoreSamanthaCoverage,
} from "./scoring.js";
import type { ClaraStageResult, KaiStageResult, SamanthaStageResult } from "./simulation-record.js";

function samantha(overrides: Partial<SamanthaStageResult> = {}): SamanthaStageResult {
  return { available: true, elapsedMs: 100, coverageScore: 0, ...overrides };
}

function kai(overrides: Partial<KaiStageResult> = {}): KaiStageResult {
  return { available: true, elapsedMs: 100, videoGenerated: false, note: "note", ...overrides };
}

function clara(overrides: Partial<ClaraStageResult> = {}): ClaraStageResult {
  return { available: true, runs: [], elapsedMs: 100, ...overrides };
}

describe("scoreSamanthaCoverage", () => {
  it("scores 0 when Samantha is unavailable", () => {
    expect(scoreSamanthaCoverage(samantha({ available: false }))).toBe(0);
  });

  it("scores up to 100 for a full real response (temuan + rekomendasi + ringkasan)", () => {
    const score = scoreSamanthaCoverage(
      samantha({
        temuan: [
          { icon: "🔴", judul: "a", detail: "a" },
          { icon: "🔴", judul: "b", detail: "b" },
          { icon: "🔴", judul: "c", detail: "c" },
        ],
        rekomendasi: [{ aksi: "FIX", target: "t", alasan: "a", estimasi: "e" }],
        ringkasan: "Ringkasan nyata.",
      }),
    );
    expect(score).toBe(30 + 10 + 40);
  });

  it("caps temuan/rekomendasi contribution at 3 items each", () => {
    const manyTemuan = Array.from({ length: 10 }, (_, i) => ({
      icon: "🔴",
      judul: `t${i}`,
      detail: `d${i}`,
    }));
    const score = scoreSamanthaCoverage(samantha({ temuan: manyTemuan, ringkasan: "x" }));
    expect(score).toBe(30 + 0 + 40);
  });
});

describe("scoreKaiAvailability", () => {
  it("scores 100 when available, 0 when not", () => {
    expect(scoreKaiAvailability(kai({ available: true }))).toBe(100);
    expect(scoreKaiAvailability(kai({ available: false }))).toBe(0);
  });
});

describe("scoreClara", () => {
  it("scores 0 when no persona run completed", () => {
    expect(scoreClara(clara({ runs: [] }))).toBe(0);
    expect(scoreClara(clara({ runs: [{ personaId: "p", ok: false, error: "x" }] }))).toBe(0);
  });

  it("averages overallScore across completed runs only, excluding failed ones", () => {
    const score = scoreClara(
      clara({
        runs: [
          { personaId: "a", ok: true, overallScore: 80 },
          { personaId: "b", ok: true, overallScore: 90 },
          { personaId: "c", ok: false, error: "network" },
        ],
      }),
    );
    expect(score).toBe(85);
  });
});

describe("computeSimulationScoring", () => {
  it('returns verdict "INCOMPLETE" when Clara has no completed run', () => {
    const scoring = computeSimulationScoring(samantha(), kai(), clara({ runs: [] }));
    expect(scoring.verdict).toBe("INCOMPLETE");
  });

  it('returns "GO" when overall + Samantha coverage both clear the threshold', () => {
    const scoring = computeSimulationScoring(
      samantha({
        temuan: [
          { icon: "a", judul: "a", detail: "a" },
          { icon: "b", judul: "b", detail: "b" },
        ],
        rekomendasi: [{ aksi: "FIX", target: "t", alasan: "a", estimasi: "e" }],
        ringkasan: "x",
      }),
      kai({ available: true }),
      clara({ runs: [{ personaId: "a", ok: true, overallScore: 90 }] }),
    );
    expect(scoring.samanthaCoverageScore).toBe(70);
    expect(scoring.verdict).toBe("GO");
    expect(scoring.grade).toBe("B");
  });

  it('returns "NO-GO" for a low but complete run', () => {
    const scoring = computeSimulationScoring(
      samantha({ available: false }),
      kai({ available: false }),
      clara({ runs: [{ personaId: "a", ok: true, overallScore: 20 }] }),
    );
    expect(scoring.verdict).toBe("NO-GO");
    expect(scoring.grade).toBe("F");
  });

  it("rounds overallScore to one decimal place", () => {
    const scoring = computeSimulationScoring(
      samantha({ ringkasan: "x" }),
      kai({ available: true }),
      clara({ runs: [{ personaId: "a", ok: true, overallScore: 77 }] }),
    );
    expect(scoring.overallScore).toBeCloseTo(71.2, 5);
  });

  describe("HOUSING-category-check criterion (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 5)", () => {
    it("leaves housingCategoryOk undefined and the score untouched for AUTOMOTIVE (default)", () => {
      const scoring = computeSimulationScoring(
        samantha({ ringkasan: "x" }),
        kai({ available: true }),
        clara({ runs: [{ personaId: "a", ok: true, overallScore: 77 }] }),
      );
      expect(scoring.housingCategoryOk).toBeUndefined();
      expect(scoring.overallScore).toBeCloseTo(71.2, 5);
    });

    it("subtracts HOUSING_CATEGORY_PENALTY and sets housingCategoryOk=false for a PROPERTY run missing HOUSING", () => {
      const withoutHousing = computeSimulationScoring(
        samantha({ ringkasan: "x", audienceTargeting: undefined }),
        kai({ available: true }),
        clara({ runs: [{ personaId: "a", ok: true, overallScore: 77 }] }),
        "PROPERTY",
      );
      expect(withoutHousing.housingCategoryOk).toBe(false);
      expect(withoutHousing.overallScore).toBeCloseTo(51.2, 5);
      // A verdict this low, even before the penalty, would already be CONDITIONAL/NO-GO — assert
      // the penalty specifically pushes an otherwise-GO-eligible run out of GO.
      expect(withoutHousing.verdict).not.toBe("GO");
    });

    it("does not penalize a PROPERTY run whose preview correctly set specialAdCategories: ['HOUSING']", () => {
      const withHousing = computeSimulationScoring(
        samantha({
          ringkasan: "x",
          audienceTargeting: {
            branch: "BINTARO",
            geo: ["Tangerang Selatan"],
            radiusKm: 25,
            ageMin: 27,
            ageMax: 55,
            geoNote: "note",
            candidateCount: 0,
            interests: [],
            specialAdCategories: ["HOUSING"],
          },
        }),
        kai({ available: true }),
        clara({ runs: [{ personaId: "a", ok: true, overallScore: 77 }] }),
        "PROPERTY",
      );
      expect(withHousing.housingCategoryOk).toBe(true);
      expect(withHousing.overallScore).toBeCloseTo(71.2, 5);
    });
  });
});

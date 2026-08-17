import { describe, expect, it } from "vitest";

import {
  computeSimulationScoring,
  scoreJessy,
  scoreKaiAvailability,
  scoreTamaraCoverage,
} from "./scoring.js";
import type { JessyStageResult, KaiStageResult, TamaraStageResult } from "./simulation-record.js";

function tamara(overrides: Partial<TamaraStageResult> = {}): TamaraStageResult {
  return { available: true, elapsedMs: 100, coverageScore: 0, ...overrides };
}

function kai(overrides: Partial<KaiStageResult> = {}): KaiStageResult {
  return { available: true, elapsedMs: 100, videoGenerated: false, note: "note", ...overrides };
}

function jessy(overrides: Partial<JessyStageResult> = {}): JessyStageResult {
  return { available: true, runs: [], elapsedMs: 100, ...overrides };
}

describe("scoreTamaraCoverage", () => {
  it("scores 0 when Tamara is unavailable", () => {
    expect(scoreTamaraCoverage(tamara({ available: false }))).toBe(0);
  });

  it("scores up to 100 for a full real response (temuan + rekomendasi + ringkasan)", () => {
    const score = scoreTamaraCoverage(
      tamara({
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
    const score = scoreTamaraCoverage(tamara({ temuan: manyTemuan, ringkasan: "x" }));
    expect(score).toBe(30 + 0 + 40);
  });
});

describe("scoreKaiAvailability", () => {
  it("scores 100 when available, 0 when not", () => {
    expect(scoreKaiAvailability(kai({ available: true }))).toBe(100);
    expect(scoreKaiAvailability(kai({ available: false }))).toBe(0);
  });
});

describe("scoreJessy", () => {
  it("scores 0 when no persona run completed", () => {
    expect(scoreJessy(jessy({ runs: [] }))).toBe(0);
    expect(scoreJessy(jessy({ runs: [{ personaId: "p", ok: false, error: "x" }] }))).toBe(0);
  });

  it("averages overallScore across completed runs only, excluding failed ones", () => {
    const score = scoreJessy(
      jessy({
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
  it('returns verdict "INCOMPLETE" when Jessy has no completed run', () => {
    const scoring = computeSimulationScoring(tamara(), kai(), jessy({ runs: [] }));
    expect(scoring.verdict).toBe("INCOMPLETE");
  });

  it('returns "GO" when overall + Tamara coverage both clear the threshold', () => {
    const scoring = computeSimulationScoring(
      tamara({
        temuan: [
          { icon: "a", judul: "a", detail: "a" },
          { icon: "b", judul: "b", detail: "b" },
        ],
        rekomendasi: [{ aksi: "FIX", target: "t", alasan: "a", estimasi: "e" }],
        ringkasan: "x",
      }),
      kai({ available: true }),
      jessy({ runs: [{ personaId: "a", ok: true, overallScore: 90 }] }),
    );
    expect(scoring.tamaraCoverageScore).toBe(70);
    expect(scoring.verdict).toBe("GO");
    expect(scoring.grade).toBe("B");
  });

  it('returns "NO-GO" for a low but complete run', () => {
    const scoring = computeSimulationScoring(
      tamara({ available: false }),
      kai({ available: false }),
      jessy({ runs: [{ personaId: "a", ok: true, overallScore: 20 }] }),
    );
    expect(scoring.verdict).toBe("NO-GO");
    expect(scoring.grade).toBe("F");
  });

  it("rounds overallScore to one decimal place", () => {
    const scoring = computeSimulationScoring(
      tamara({ ringkasan: "x" }),
      kai({ available: true }),
      jessy({ runs: [{ personaId: "a", ok: true, overallScore: 77 }] }),
    );
    expect(scoring.overallScore).toBeCloseTo(71.2, 5);
  });
});

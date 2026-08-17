import type {
  Grade,
  JessyStageResult,
  KaiStageResult,
  SimulationScoring,
  TamaraStageResult,
  Verdict,
} from "./simulation-record.js";

/**
 * `SIMULATION_CRITERIA` — coordinator note #9: these exact numbers (`minOverallScore: 70`,
 * `minTamaraScore: 65`) are the ORIGINAL spec's own proposed business rules, not derived from any
 * existing real scoring logic elsewhere in this codebase. Implemented literally because they're
 * reasonable/self-consistent and don't conflict with anything real — but they are UI-spec-defined
 * thresholds, not verified against any backend contract. A future task may want these tuned once
 * DSS Motor has real simulation history to calibrate against.
 */
export const SIMULATION_CRITERIA = {
  minOverallScore: 70,
  minTamaraScore: 65,
} as const;

/**
 * `POST /api/v1/llm/analyze`'s real response is qualitative (findings/recommendations/summary —
 * see `llm.service.ts`), not a numeric score. This derives a deterministic, inspectable PROXY
 * score from real response field counts, so the simulation's overall gate has *something* numeric
 * to work with for Tamara's stage — never a fabricated/random number, always computed from the
 * real response that was actually received. `available: false` (no API key / provider error /
 * invalid response) always scores 0 — an unavailable stage cannot count toward a passing gate.
 */
export function scoreTamaraCoverage(tamara: TamaraStageResult): number {
  if (!tamara.available) {
    return 0;
  }
  const temuanScore = Math.min(tamara.temuan?.length ?? 0, 3) * 10; // up to 30
  const rekomendasiScore = Math.min(tamara.rekomendasi?.length ?? 0, 3) * 10; // up to 30
  const ringkasanScore = (tamara.ringkasan?.length ?? 0) > 0 ? 40 : 0; // 40
  return Math.min(temuanScore + rekomendasiScore + ringkasanScore, 100);
}

/**
 * Step 3 (Kai) has no real quality score either in this pass (real Kie AI video/image generation
 * is not invoked — see `simulation.service.ts`'s class doc). This is deliberately a coarse,
 * honestly-labeled binary signal (a real brief was generated, or it wasn't) rather than a fake
 * fine-grained "creative quality" number this codebase has no way to actually compute.
 */
export function scoreKaiAvailability(kai: KaiStageResult): number {
  return kai.available ? 100 : 0;
}

/** Real numeric `overallScore` from `apps/aaos-simulator`'s AI Judge, averaged across every persona that actually completed (personas that errored are excluded from the average, not scored 0 — a transport/upstream failure isn't a conversation-quality signal). `undefined` (no persona completed) is treated as unavailable, scoring 0. */
export function scoreJessy(jessy: JessyStageResult): number {
  const completed = jessy.runs.filter((run) => run.ok && run.overallScore !== undefined);
  if (completed.length === 0) {
    return 0;
  }
  const sum = completed.reduce((total, run) => total + (run.overallScore ?? 0), 0);
  return sum / completed.length;
}

/**
 * Weighting judgment call (coordinator note #9's same caveat applies): Jessy+Judge — the stage
 * with a real, upstream-computed numeric score — is weighted heaviest (60%); Tamara's derived
 * coverage proxy 25%; Kai's binary availability signal 15% (it's the least informative of the
 * three, being available/unavailable only).
 */
const WEIGHTS = { tamara: 0.25, kai: 0.15, jessy: 0.6 } as const;

function toGrade(overallScore: number): Grade {
  if (overallScore >= 90) return "A";
  if (overallScore >= 80) return "B";
  if (overallScore >= 70) return "C";
  if (overallScore >= 60) return "D";
  return "F";
}

/**
 * Computes the full `SimulationScoring` gate. `verdict` is `"INCOMPLETE"` (not `"NO-GO"`) whenever
 * the Jessy/Judge stage produced no completed persona run at all (e.g. `AAOS_SIMULATOR_BASE_URL`
 * unset) — an incomplete pipeline is a different, honestly-distinct outcome from "we ran it and it
 * failed the bar".
 */
export function computeSimulationScoring(
  tamara: TamaraStageResult,
  kai: KaiStageResult,
  jessy: JessyStageResult,
): SimulationScoring {
  const tamaraCoverageScore = scoreTamaraCoverage(tamara);
  const kaiScore = scoreKaiAvailability(kai);
  const jessyScore = scoreJessy(jessy);
  const overallScore =
    tamaraCoverageScore * WEIGHTS.tamara + kaiScore * WEIGHTS.kai + jessyScore * WEIGHTS.jessy;

  const jessyIncomplete = jessy.runs.filter((run) => run.ok).length === 0;
  let verdict: Verdict;
  if (jessyIncomplete) {
    verdict = "INCOMPLETE";
  } else if (
    overallScore >= SIMULATION_CRITERIA.minOverallScore &&
    tamaraCoverageScore >= SIMULATION_CRITERIA.minTamaraScore
  ) {
    verdict = "GO";
  } else if (overallScore >= 55) {
    verdict = "CONDITIONAL";
  } else {
    verdict = "NO-GO";
  }

  return {
    tamaraCoverageScore,
    kaiScore,
    jessyScore,
    overallScore: Math.round(overallScore * 10) / 10,
    grade: toGrade(overallScore),
    verdict,
  };
}

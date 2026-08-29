import type {
  Grade,
  ClaraStageResult,
  KaiStageResult,
  SimulationScoring,
  SamanthaStageResult,
  Verdict,
} from "./simulation-record.js";

/**
 * `SIMULATION_CRITERIA` — coordinator note #9: these exact numbers (`minOverallScore: 70`,
 * `minSamanthaScore: 65`) are the ORIGINAL spec's own proposed business rules, not derived from any
 * existing real scoring logic elsewhere in this codebase. Implemented literally because they're
 * reasonable/self-consistent and don't conflict with anything real — but they are UI-spec-defined
 * thresholds, not verified against any backend contract. A future task may want these tuned once
 * DSS Motor has real simulation history to calibrate against.
 */
export const SIMULATION_CRITERIA = {
  minOverallScore: 70,
  minSamanthaScore: 65,
} as const;

/**
 * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 5 (Document 2 section E, Step 5) — points subtracted
 * from `overallScore` for a `PROPERTY` simulation whose audience-targeting preview did NOT include
 * Meta's mandatory `'HOUSING'` special ad category. Same "judgment-call, spec-pinned" caveat as
 * `SIMULATION_CRITERIA` above.
 */
export const HOUSING_CATEGORY_PENALTY = 20;

/**
 * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 5 (Document 2 section E, Step 5) — vertical-specific
 * Indonesian copy for the AI Judge panel's grade/verdict labels. Consumed by
 * `apps/aaos-dashboard`'s Judge step UI; kept here (not duplicated dashboard-side) so the labels
 * stay attached to the same `Grade`/`Verdict` values this module computes.
 */
export const JUDGE_LABELS_BY_VERTICAL: Readonly<
  Record<
    "AUTOMOTIVE" | "PROPERTY",
    { readonly title: string; readonly verdictLabels: Readonly<Record<Verdict, string>> }
  >
> = {
  AUTOMOTIVE: {
    title: "AI Judge — Kelayakan Campaign Mobil",
    verdictLabels: {
      GO: "Layak Live — lanjutkan ke Go Live",
      CONDITIONAL: "Layak Bersyarat — review sebelum Go Live",
      "NO-GO": "Tidak Layak — jangan Go Live",
      INCOMPLETE: "Simulasi Belum Lengkap",
    },
  },
  PROPERTY: {
    title: "AI Judge — Kelayakan Campaign Properti",
    verdictLabels: {
      GO: "Layak Live — patuh kebijakan HOUSING, lanjutkan ke Go Live",
      CONDITIONAL: "Layak Bersyarat — review kebijakan HOUSING sebelum Go Live",
      "NO-GO": "Tidak Layak — jangan Go Live",
      INCOMPLETE: "Simulasi Belum Lengkap",
    },
  },
} as const;

/**
 * `POST /api/v1/llm/analyze`'s real response is qualitative (findings/recommendations/summary —
 * see `llm.service.ts`), not a numeric score. This derives a deterministic, inspectable PROXY
 * score from real response field counts, so the simulation's overall gate has *something* numeric
 * to work with for Samantha's stage — never a fabricated/random number, always computed from the
 * real response that was actually received. `available: false` (no API key / provider error /
 * invalid response) always scores 0 — an unavailable stage cannot count toward a passing gate.
 */
export function scoreSamanthaCoverage(samantha: SamanthaStageResult): number {
  if (!samantha.available) {
    return 0;
  }
  const temuanScore = Math.min(samantha.temuan?.length ?? 0, 3) * 10; // up to 30
  const rekomendasiScore = Math.min(samantha.rekomendasi?.length ?? 0, 3) * 10; // up to 30
  const ringkasanScore = (samantha.ringkasan?.length ?? 0) > 0 ? 40 : 0; // 40
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
export function scoreClara(clara: ClaraStageResult): number {
  const completed = clara.runs.filter((run) => run.ok && run.overallScore !== undefined);
  if (completed.length === 0) {
    return 0;
  }
  const sum = completed.reduce((total, run) => total + (run.overallScore ?? 0), 0);
  return sum / completed.length;
}

/**
 * Weighting judgment call (coordinator note #9's same caveat applies): Clara+Judge — the stage
 * with a real, upstream-computed numeric score — is weighted heaviest (60%); Samantha's derived
 * coverage proxy 25%; Kai's binary availability signal 15% (it's the least informative of the
 * three, being available/unavailable only).
 */
const WEIGHTS = { samantha: 0.25, kai: 0.15, clara: 0.6 } as const;

function toGrade(overallScore: number): Grade {
  if (overallScore >= 90) return "A";
  if (overallScore >= 80) return "B";
  if (overallScore >= 70) return "C";
  if (overallScore >= 60) return "D";
  return "F";
}

/**
 * Computes the full `SimulationScoring` gate. `verdict` is `"INCOMPLETE"` (not `"NO-GO"`) whenever
 * the Clara/Judge stage produced no completed persona run at all (e.g. `AAOS_SIMULATOR_BASE_URL`
 * unset) — an incomplete pipeline is a different, honestly-distinct outcome from "we ran it and it
 * failed the bar".
 */
export function computeSimulationScoring(
  samantha: SamanthaStageResult,
  kai: KaiStageResult,
  clara: ClaraStageResult,
  /**
   * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 5 — the tenant's real resolved vertical
   * (`SimulationService.resolveVertical`). Optional and defaulted to `"AUTOMOTIVE"` so every
   * pre-existing call site (and every pre-Phase-5 test) keeps its exact prior behavior — the
   * HOUSING criterion below only ever applies when a caller explicitly passes `"PROPERTY"`.
   */
  vertical: "AUTOMOTIVE" | "PROPERTY" = "AUTOMOTIVE",
): SimulationScoring {
  const samanthaCoverageScore = scoreSamanthaCoverage(samantha);
  const kaiScore = scoreKaiAvailability(kai);
  const claraScore = scoreClara(clara);
  let overallScore =
    samanthaCoverageScore * WEIGHTS.samantha + kaiScore * WEIGHTS.kai + claraScore * WEIGHTS.clara;

  // AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 5, Step 5 — HOUSING-category-check criterion:
  // a PROPERTY simulation whose audience-targeting preview didn't set Meta's mandatory
  // `specialAdCategories: ['HOUSING']` loses HOUSING_CATEGORY_PENALTY points. `housingCategoryOk`
  // stays `undefined` for AUTOMOTIVE (the criterion doesn't apply to it at all — not "true").
  let housingCategoryOk: boolean | undefined;
  if (vertical === "PROPERTY") {
    housingCategoryOk = (samantha.audienceTargeting?.specialAdCategories ?? []).includes("HOUSING");
    if (!housingCategoryOk) {
      overallScore = Math.max(0, overallScore - HOUSING_CATEGORY_PENALTY);
    }
  }

  const claraIncomplete = clara.runs.filter((run) => run.ok).length === 0;
  let verdict: Verdict;
  if (claraIncomplete) {
    verdict = "INCOMPLETE";
  } else if (
    overallScore >= SIMULATION_CRITERIA.minOverallScore &&
    samanthaCoverageScore >= SIMULATION_CRITERIA.minSamanthaScore &&
    housingCategoryOk !== false
  ) {
    verdict = "GO";
  } else if (overallScore >= 55) {
    verdict = "CONDITIONAL";
  } else {
    verdict = "NO-GO";
  }

  return {
    samanthaCoverageScore,
    kaiScore,
    claraScore,
    overallScore: Math.round(overallScore * 10) / 10,
    grade: toGrade(overallScore),
    verdict,
    ...(housingCategoryOk !== undefined ? { housingCategoryOk } : {}),
  };
}

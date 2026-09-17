import { Verdict } from "@aos/meta-ads-connector";

import type { SamanthaSignalType } from "../../metric-snapshot/domain/signal-engine.js";

import type { CampaignHealth } from "./campaign-health.js";
import type { CampaignDiagnosis, DiagnosisImpact } from "./diagnosis.js";

/**
 * EYVRA — SAMANTHA V2 Phase 4. Pure, deterministic, total "diagnosis -> decision" mapping over an
 * already-computed `CampaignHealth` + `CampaignDiagnosis` (Phase 3) — no I/O, no LLM call, same
 * discipline `campaign-health.ts`/`diagnosis.ts` already establish.
 *
 * CRITICAL SCOPE NOTE — read before touching this file: this whole phase produces a
 * `SamanthaDecision` RECOMMENDATION OBJECT ONLY. `decideNextAction` NEVER calls
 * `MetaAdsService.executeVerdict`, NEVER creates a `creative_packages` row, NEVER writes to
 * `pending_agent_actions`, and NEVER mutates anything anywhere. The real execution/approval-gate
 * machinery for that already exists (`PendingActionsService`/`ModeGuardService`) and wiring THIS
 * decision object into that real execution path is explicitly OUT OF SCOPE for this phase — a
 * separate, future, carefully-scoped phase, exactly like Phase 3 deferred wiring `CampaignDiagnosis`
 * into `LlmService.campaignInsight`.
 *
 * ACTION TAXONOMY — deliberately NOT the raw SAMANTHA V2 spec's ~25 fictional action types
 * (`CREATE_CAMPAIGN`, `INCREASE_BUDGET`, `CHANGE_BID_STRATEGY`, `ROLLBACK_PREVIOUS_ACTION`, etc.).
 * `Verdict` (`@aos/meta-ads-connector`) is the ONLY real, already-executable action taxonomy in
 * this codebase (`MetaAdsService.executeVerdict` is its real mutation path), so `RecommendedActionType`
 * reuses those 6 real values directly — one source of truth, never a parallel enum with the same
 * meaning — plus 3 honest additions this codebase can genuinely, distinguishably support today:
 * `NO_ACTION` (nothing to do), `MONITOR` (not enough signal to decide yet), and
 * `REQUEST_KAI_CREATIVE` (a real `creative_packages` brief request — distinct from `Verdict.REFRESH`,
 * which is "the ad's own verdict says refresh", not "ask Kai for new creative").
 */
export type RecommendedActionType = "NO_ACTION" | "MONITOR" | "REQUEST_KAI_CREATIVE" | Verdict;

export interface MonitoringPlan {
  /**
   * Real, deterministic review window in hours — shorter for higher-impact/higher-confidence
   * diagnoses. No existing "review after N hours" convention was found anywhere in this codebase
   * (grepped `apps/aaos-api/src` and `skills/` for a "72" hour precedent per the phase brief —
   * none exists yet), so these are freshly chosen, documented numbers rather than a reused
   * constant: 24h for CRITICAL impact (real spend actively bleeding, or a confirmed positive
   * signal worth scaling fast), 48h for HIGH, 72h for MEDIUM/LOW (a full Meta ad-set learning-ish
   * cycle — enough time for a real trend to show, not so long a real problem festers), and 72h as
   * the honest MONITOR/UNKNOWN default (no clear signal yet — check back in a similarly modest
   * window rather than inventing a longer "wait and see" number with no backing).
   */
  readonly reviewAfterHours: number;
  /** Indonesian, specific — references the real metric/dimension that triggered the decision. */
  readonly successConditions: readonly string[];
  /** Indonesian, specific — empty when `decision` is `"NO_ACTION"`/`"MONITOR"` (nothing to roll back from doing nothing). */
  readonly rollbackConditions: readonly string[];
}

export interface SamanthaDecision {
  readonly decision: RecommendedActionType;
  /** `diagnosis.rootCause` echoed through — `undefined` when there is none. */
  readonly primaryDiagnosis?: SamanthaSignalType;
  /** Ties to `diagnosis.confidence`. */
  readonly confidence: number;
  /** Ties to `diagnosis.impact`. */
  readonly impact: DiagnosisImpact;
  /** Indonesian, references the real rootCause/dimension. */
  readonly reason: string;
  /** Indonesian — honest: `"Tidak ada risiko signifikan"` for `NO_ACTION`, specific for everything else. */
  readonly riskOfDoingNothing: string;
  /** Indonesian, HEDGED language ("berpotensi"/"diperkirakan") — never a guarantee. */
  readonly expectedOutcome: string;
  readonly monitoringPlan: MonitoringPlan;
}

const REVIEW_HOURS_BY_IMPACT: Record<DiagnosisImpact, number> = {
  CRITICAL: 24,
  HIGH: 48,
  MEDIUM: 72,
  LOW: 72,
  UNKNOWN: 72,
};

function monitoringPlanFor(
  impact: DiagnosisImpact,
  successConditions: readonly string[],
  rollbackConditions: readonly string[],
): MonitoringPlan {
  return {
    reviewAfterHours: REVIEW_HOURS_BY_IMPACT[impact],
    successConditions,
    rollbackConditions,
  };
}

function noRiskMonitoringPlan(): MonitoringPlan {
  return monitoringPlanFor(
    "UNKNOWN",
    ["Data sufficiency naik ke MEDIUM/HIGH sehingga campaign health bisa dinilai ulang."],
    [],
  );
}

/**
 * `overallStatus === "UNKNOWN"` means all 7 `CampaignHealth` dimensions are genuinely `UNKNOWN` —
 * there is no usable signal at all, not even enough to flag a WATCH/WARNING concern.
 */
function decideForNoUsableData(): SamanthaDecision {
  return {
    decision: "MONITOR",
    confidence: 0,
    impact: "UNKNOWN",
    reason:
      "Belum ada data yang cukup di satu pun dari 7 dimensi campaign health untuk membuat keputusan.",
    riskOfDoingNothing:
      "Tidak ada risiko signifikan — campaign ini belum punya cukup data untuk dinilai, jadi belum ada masalah nyata yang diketahui untuk diabaikan.",
    expectedOutcome:
      "Data diperkirakan akan cukup untuk dinilai setelah campaign berjalan lebih lama.",
    monitoringPlan: noRiskMonitoringPlan(),
  };
}

function decideForHealthy(): SamanthaDecision {
  return {
    decision: "NO_ACTION",
    confidence: 1,
    impact: "LOW",
    reason: "Semua dimensi campaign health yang punya data nyata berstatus HEALTHY.",
    riskOfDoingNothing: "Tidak ada risiko signifikan.",
    expectedOutcome:
      "Performa campaign berpotensi tetap stabil selama tidak ada perubahan berarti.",
    monitoringPlan: monitoringPlanFor(
      "LOW",
      ["overallStatus tetap HEALTHY pada penilaian berikutnya."],
      [],
    ),
  };
}

/**
 * `overallStatus` is something else non-`UNKNOWN` (e.g. a dimension is WATCH/WARNING purely from
 * data-sufficiency) but `diagnosis.rootCause` is `undefined` — `health` flags a real concern, but
 * there is no signal-correlated root cause clear enough yet to act on. Honest `MONITOR`, not a
 * confident verdict this layer cannot actually back with evidence.
 */
function decideForFlaggedButNoRootCause(health: CampaignHealth): SamanthaDecision {
  return {
    decision: "MONITOR",
    confidence: 0,
    impact: "UNKNOWN",
    reason: `overallStatus campaign health adalah ${health.overallStatus}, tetapi belum ada root cause dari sinyal nyata yang cukup jelas untuk ditindaklanjuti.`,
    riskOfDoingNothing:
      "Ada dimensi yang belum HEALTHY, tetapi tanpa root cause yang jelas, bertindak sekarang berisiko salah sasaran — lebih aman memantau dulu.",
    expectedOutcome:
      "Root cause diperkirakan akan lebih jelas setelah lebih banyak data/sinyal terkumpul.",
    monitoringPlan: monitoringPlanFor(
      "UNKNOWN",
      ["Muncul root cause (SamanthaSignal) yang jelas dari salah satu dimensi yang belum HEALTHY."],
      [],
    ),
  };
}

interface RootCauseDecisionSpec {
  readonly decision: RecommendedActionType;
  readonly reason: (diagnosis: CampaignDiagnosis) => string;
  readonly riskOfDoingNothing: string;
  readonly expectedOutcome: string;
  readonly successConditions: readonly string[];
  readonly rollbackConditions: readonly string[];
}

const ROOT_CAUSE_DECISIONS: Partial<Record<SamanthaSignalType, RootCauseDecisionSpec>> = {
  SPEND_WITHOUT_RESULT: {
    decision: Verdict.PAUSE,
    reason: () =>
      "Root cause SPEND_WITHOUT_RESULT: budget nyata sudah terpakai tanpa lead nyata — sinyal paling jelas untuk menghentikan spend.",
    riskOfDoingNothing:
      "Budget akan terus terpakai tanpa menghasilkan lead nyata selama campaign dibiarkan jalan.",
    expectedOutcome:
      "Menghentikan campaign berpotensi mencegah pemborosan budget lebih lanjut sambil diagnosis diperdalam.",
    successConditions: ["Campaign berhenti membelanjakan budget tanpa lead nyata."],
    rollbackConditions: [
      "Setelah dianalisis ulang, campaign ternyata sudah menghasilkan lead nyata di luar window yang diukur — campaign bisa dijalankan kembali.",
    ],
  },
  CREATIVE_FATIGUE: {
    decision: "REQUEST_KAI_CREATIVE",
    reason: (diagnosis) =>
      `Root cause CREATIVE_FATIGUE terdeteksi (confidence ${String(Math.round(diagnosis.confidence * 100))}%) — creative existing kemungkinan sudah jenuh.`,
    riskOfDoingNothing:
      "CTR dan performa creative berpotensi terus menurun selama creative fatigue dibiarkan tanpa aset baru.",
    expectedOutcome: "Creative baru dari Kai berpotensi memulihkan CTR ke level sebelum fatigue.",
    successConditions: [
      "Dimensi creative kembali ke status HEALTHY setelah creative baru dari Kai tayang.",
    ],
    rollbackConditions: [
      "Creative baru dari Kai tidak memperbaiki dimensi creative dalam periode review — perlu diagnosis ulang.",
    ],
  },
  FREQUENCY_RISE: {
    decision: Verdict.REFRESH,
    reason: (diagnosis) =>
      `Root cause FREQUENCY_RISE terdeteksi (confidence ${String(Math.round(diagnosis.confidence * 100))}%) — audience mulai melihat ad yang sama berulang kali.`,
    riskOfDoingNothing:
      "Frequency yang terus naik berpotensi mempercepat creative fatigue dan menaikkan CPL.",
    expectedOutcome: "Refresh berpotensi menurunkan frequency dan menjaga CTR tetap sehat.",
    successConditions: [
      "Frequency kembali ke bawah ambang FREQUENCY_RISE pada penilaian berikutnya.",
    ],
    rollbackConditions: [
      "Frequency tetap naik meski sudah di-refresh — perlu diagnosis ulang, bukan refresh berulang.",
    ],
  },
  CTR_DROP: {
    decision: Verdict.REVIEW,
    reason: (diagnosis) =>
      `Root cause CTR_DROP terdeteksi (confidence ${String(Math.round(diagnosis.confidence * 100))}%) — dimensi conversion perlu ditinjau manusia. Lapisan deterministik ini tidak bisa membedakan apakah penyebabnya creative, targeting, atau pasar hanya dari sinyal CTR_DROP saja, sehingga REVIEW (bukan FIX/PAUSE) adalah pilihan yang jujur dan tidak overconfident.`,
    riskOfDoingNothing: "CTR yang terus turun berpotensi menaikkan CPL dan menurunkan volume lead.",
    expectedOutcome:
      "Review manusia berpotensi mengidentifikan penyebab pasti dan tindakan yang tepat.",
    successConditions: ["CTR kembali ke bawah ambang CTR_DROP pada penilaian berikutnya."],
    rollbackConditions: [
      "Review manusia menyimpulkan tidak ada tindakan lanjutan yang diperlukan — status quo dipertahankan.",
    ],
  },
  CPL_SPIKE: {
    decision: Verdict.REVIEW,
    reason: (diagnosis) =>
      `Root cause CPL_SPIKE terdeteksi (confidence ${String(Math.round(diagnosis.confidence * 100))}%) — dimensi costEfficiency perlu ditinjau manusia. Lapisan deterministik ini tidak bisa membedakan apakah penyebabnya creative, targeting, atau pasar hanya dari sinyal CPL_SPIKE saja, sehingga REVIEW (bukan FIX/PAUSE) adalah pilihan yang jujur dan tidak overconfident.`,
    riskOfDoingNothing:
      "CPL yang terus naik berpotensi menghabiskan budget lebih cepat dari yang direncanakan.",
    expectedOutcome:
      "Review manusia berpotensi mengidentifikan penyebab pasti dan tindakan yang tepat.",
    successConditions: [
      "CPL kembali ke bawah ambang CPL_SPIKE (relatif ke benchmark) pada penilaian berikutnya.",
    ],
    rollbackConditions: [
      "Review manusia menyimpulkan tidak ada tindakan lanjutan yang diperlukan — status quo dipertahankan.",
    ],
  },
  CTR_IMPROVEMENT: {
    decision: Verdict.SCALE,
    reason: (diagnosis) =>
      `Root cause CTR_IMPROVEMENT terdeteksi (confidence ${String(Math.round(diagnosis.confidence * 100))}%) — sinyal positif nyata pada CTR.`,
    riskOfDoingNothing: "Momentum performa positif berpotensi tidak dimanfaatkan secara maksimal.",
    expectedOutcome: "Scaling berpotensi memperbesar hasil positif yang sudah terlihat pada CTR.",
    successConditions: ["CTR tetap di atas ambang CTR_IMPROVEMENT setelah scaling."],
    rollbackConditions: [
      "Setelah scaling, CTR atau CPL justru memburuk — scaling perlu dibatalkan/ditinjau ulang.",
    ],
  },
  CPL_IMPROVEMENT: {
    decision: Verdict.SCALE,
    reason: (diagnosis) =>
      `Root cause CPL_IMPROVEMENT terdeteksi (confidence ${String(Math.round(diagnosis.confidence * 100))}%) — sinyal positif nyata pada CPL.`,
    riskOfDoingNothing: "Momentum performa positif berpotensi tidak dimanfaatkan secara maksimal.",
    expectedOutcome: "Scaling berpotensi memperbesar hasil positif yang sudah terlihat pada CPL.",
    successConditions: ["CPL tetap di bawah benchmark setelah scaling."],
    rollbackConditions: [
      "Setelah scaling, CPL justru memburuk — scaling perlu dibatalkan/ditinjau ulang.",
    ],
  },
};

/**
 * Safe, honest default for a real `rootCause` that is NOT one of the 8 mapped signal types above
 * (today that's only `INSUFFICIENT_DATA`, which `diagnoseCampaign` never actually sets as a
 * `rootCause` — but this branch exists for any future `SamanthaSignalType` added to the signal
 * engine without a matching entry here) — `REVIEW`, never a silent fallthrough to `NO_ACTION` for
 * a real, unrecognized signal.
 */
const DEFAULT_ROOT_CAUSE_DECISION: RootCauseDecisionSpec = {
  decision: Verdict.REVIEW,
  reason: (diagnosis) =>
    `Root cause ${diagnosis.rootCause ?? "TIDAK DIKETAHUI"} terdeteksi tetapi belum punya pemetaan keputusan spesifik — direview manusia sebagai default yang aman.`,
  riskOfDoingNothing:
    "Sinyal nyata terdeteksi tetapi belum punya penanganan otomatis — berisiko diabaikan tanpa review.",
  expectedOutcome:
    "Review manusia berpotensi mengidentifikan tindakan yang tepat untuk sinyal ini.",
  successConditions: ["Root cause ini sudah ditinjau dan ditindaklanjuti oleh manusia."],
  rollbackConditions: [
    "Review manusia menyimpulkan tidak ada tindakan lanjutan yang diperlukan — status quo dipertahankan.",
  ],
};

function decideForRootCause(diagnosis: CampaignDiagnosis): SamanthaDecision {
  const rootCause = diagnosis.rootCause as SamanthaSignalType;
  const spec = ROOT_CAUSE_DECISIONS[rootCause] ?? DEFAULT_ROOT_CAUSE_DECISION;

  return {
    decision: spec.decision,
    primaryDiagnosis: rootCause,
    confidence: diagnosis.confidence,
    impact: diagnosis.impact,
    reason: spec.reason(diagnosis),
    riskOfDoingNothing: spec.riskOfDoingNothing,
    expectedOutcome: spec.expectedOutcome,
    monitoringPlan: monitoringPlanFor(
      diagnosis.impact,
      spec.successConditions,
      spec.rollbackConditions,
    ),
  };
}

/**
 * Deterministic "diagnosis -> decision" mapping — total (every valid `CampaignHealth`/
 * `CampaignDiagnosis` pair produces a valid `SamanthaDecision`), pure, throws nothing.
 *
 * Decision table (evaluated top to bottom, mirrors the phase brief's real precedence):
 *  1. `health.overallStatus === "UNKNOWN"` (all 7 dimensions genuinely UNKNOWN) -> `MONITOR`,
 *     confidence 0, impact UNKNOWN.
 *  2. `diagnosis.rootCause === undefined` AND `overallStatus === "HEALTHY"` -> `NO_ACTION`.
 *  3. `diagnosis.rootCause === undefined` AND `overallStatus` is anything else (a dimension is
 *     WATCH/WARNING/CRITICAL from data-sufficiency alone, no correlated signal) -> `MONITOR`.
 *  4. `diagnosis.rootCause` is real -> mapped via `ROOT_CAUSE_DECISIONS` (falls back to the
 *     documented `REVIEW` default for any unmapped-but-real signal type).
 */
export function decideNextAction(
  health: CampaignHealth,
  diagnosis: CampaignDiagnosis,
): SamanthaDecision {
  if (health.overallStatus === "UNKNOWN") {
    return decideForNoUsableData();
  }

  if (diagnosis.rootCause === undefined) {
    return health.overallStatus === "HEALTHY"
      ? decideForHealthy()
      : decideForFlaggedButNoRootCause(health);
  }

  return decideForRootCause(diagnosis);
}

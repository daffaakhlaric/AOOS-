import type {
  SamanthaSignal,
  SamanthaSignalSeverity,
  SamanthaSignalType,
} from "../../metric-snapshot/domain/signal-engine.js";

import { HEALTH_DIMENSION_NAMES } from "./campaign-health.js";
import type { CampaignHealth, HealthDimensionName } from "./campaign-health.js";

/**
 * EYVRA — SAMANTHA V2 Phase 3. Pure, deterministic root-cause diagnosis over an already-computed
 * `CampaignHealth` + the real `SamanthaSignal[]` that fed it — no I/O, and DELIBERATELY no LLM
 * call. This is an explicit design choice, not a shortcut:
 *
 * `LlmService.campaignInsight` already exists as this app's narrative/LLM layer, and the repo
 * audit that scoped this phase flagged it as "LLM-narrative, not deterministic scoring" — i.e.
 * its recommendations are not grounded in any real, reproducible evidence object. `CampaignDiagnosis`
 * is designed to eventually become that LLM call's REAL, grounded evidence input, closing exactly
 * that gap. But wiring `CampaignDiagnosis` INTO `LlmService.campaignInsight`'s prompt is explicitly
 * OUT OF SCOPE for this phase — that touches a large, already-live, already-tested ~1900-line file
 * with real user-facing behavior, and deserves its own carefully-scoped future phase. This phase
 * produces the grounded evidence object and stops there.
 */

export type DiagnosisImpact = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN";

export interface CampaignDiagnosis {
  /** The `SamanthaSignalType` of the highest-severity real signal, or `undefined` when `signals` is empty or contains only `INSUFFICIENT_DATA`. */
  readonly rootCause?: SamanthaSignalType;
  /** Ties to the root-cause signal's own `confidence`. `0` when there is no `rootCause`. */
  readonly confidence: number;
  /** Mapped from the root-cause signal's own `severity`. `"UNKNOWN"` when there is no `rootCause`. */
  readonly impact: DiagnosisImpact;
  /** Every real signal that contributed (excluding `INSUFFICIENT_DATA`), severity-sorted worst first. Empty when there is no `rootCause`. */
  readonly evidence: readonly SamanthaSignal[];
  /** Indonesian, one line per non-root signal in `evidence` explaining its role. Empty when there is no `rootCause`. */
  readonly contributingFactors: readonly string[];
  /** Which of the 7 `CampaignHealth` dimensions are genuinely not `HEALTHY`/`UNKNOWN` — real, derived from `health`, computed regardless of whether a `rootCause` was found (a dimension can be `WATCH`/`WARNING` from data-sufficiency alone, with no correlated signal). */
  readonly recommendedFocus: readonly HealthDimensionName[];
}

/** Worst-first ordering for `SamanthaSignalSeverity` — `CRITICAL` > `HIGH` > `MEDIUM` > `LOW` > `INFO`. */
const SEVERITY_RANK: Record<SamanthaSignalSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  INFO: 0,
};

/**
 * `INFO`-severity signals (e.g. `CTR_IMPROVEMENT`/`CPL_IMPROVEMENT`) are positive news, not a
 * problem — mapped to `"LOW"` impact rather than a `"CRITICAL"`/`"HIGH"` label that would
 * mischaracterize an improvement as urgent, while still surfacing them honestly as SOME real
 * impact rather than silently dropping them from `rootCause` consideration.
 */
function severityToImpact(severity: SamanthaSignalSeverity): DiagnosisImpact {
  switch (severity) {
    case "CRITICAL":
      return "CRITICAL";
    case "HIGH":
      return "HIGH";
    case "MEDIUM":
      return "MEDIUM";
    case "LOW":
    case "INFO":
      return "LOW";
  }
}

function contributingFactorLine(signal: SamanthaSignal): string {
  return `Faktor pendukung (${signal.type}): ${signal.reasoning}`;
}

function computeRecommendedFocus(health: CampaignHealth): HealthDimensionName[] {
  return HEALTH_DIMENSION_NAMES.filter((name) => {
    const status = health[name].status;
    return status !== "HEALTHY" && status !== "UNKNOWN";
  });
}

export function diagnoseCampaign(
  health: CampaignHealth,
  signals: readonly SamanthaSignal[],
): CampaignDiagnosis {
  const recommendedFocus = computeRecommendedFocus(health);

  const realSignals = signals.filter((signal) => signal.type !== "INSUFFICIENT_DATA");
  if (realSignals.length === 0) {
    return {
      confidence: 0,
      impact: "UNKNOWN",
      evidence: [],
      contributingFactors: [],
      recommendedFocus,
    };
  }

  const evidence = [...realSignals].sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
  );
  const [rootSignal, ...restSignals] = evidence;
  // `evidence.length > 0` was just established above — `rootSignal` is always real here.
  const rootCauseSignal = rootSignal as SamanthaSignal;

  return {
    rootCause: rootCauseSignal.type,
    confidence: rootCauseSignal.confidence,
    impact: severityToImpact(rootCauseSignal.severity),
    evidence,
    contributingFactors: restSignals.map(contributingFactorLine),
    recommendedFocus,
  };
}

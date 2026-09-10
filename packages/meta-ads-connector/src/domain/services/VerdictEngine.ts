import type { LearningStatus } from "../entities/AdSet.js";
import { CampaignObjective } from "../value-objects/CampaignObjective.js";
import type { Rph } from "../value-objects/Rph.js";
import { Verdict } from "../value-objects/Verdict.js";

/** Placement note: pure business-rule evaluation with no I/O, so it lives under `domain/` (a
 * `domain/services/` — a pure-function module, not a class needing DI) rather than
 * `application/services/`, per the task's domain-design-guidance judgment call. */
export interface VerdictEngineInput {
  readonly rphChat: Rph;
  readonly conversations: number;
  readonly spendAmount: number;
  readonly frequency: number;
  readonly objective: CampaignObjective;
  /**
   * AAOS Samantha Professional Optimizer, Part A — the parent AdSet's real Meta
   * `learning_stage_info.status` (see `domain/entities/AdSet.ts`'s `LearningStatus`). Optional,
   * defaulting to `undefined` (no suppression applied) — every pre-existing call site/test that
   * omits this field keeps observing the exact same raw threshold behavior as before this field
   * existed; `undefined` is treated identically to `"SUCCESS"` (see `applyLearningPhaseSuppression`
   * below), never a distinct "unknown, so be extra cautious" branch that would change pre-existing
   * behavior no test asked for.
   */
  readonly learningStatus?: LearningStatus;
}

const SCALE_THRESHOLD_IDR = 5_500;
const SCALE_MIN_CONVERSATIONS = 25;
const KEEP_THRESHOLD_IDR = 9_000;
const REVIEW_MAX_IDR = 22_000;
const REFRESH_FREQUENCY_THRESHOLD = 3.5;

/**
 * Evaluates the optimization verdict for a single Ad.
 *
 * Precedence (highest to lowest priority) — the spec states each threshold rule but not what
 * happens when several apply simultaneously, so this is a documented design decision:
 *
 *   1. FIX      — a misconfigured campaign objective invalidates the relevance of every
 *                 performance metric below it: the campaign isn't even optimizing for the CTWA
 *                 WhatsApp-lead funnel DSS Motor runs on, so cost/volume numbers are not
 *                 actionable until the objective itself is corrected to `OUTCOME_LEADS`.
 *                 AAOS-W1D-S3: any objective other than `OUTCOME_LEADS` triggers FIX — computed
 *                 as `objective !== OUTCOME_LEADS` rather than a hardcoded list of "bad"
 *                 objectives, so it automatically covers every current member
 *                 (`OUTCOME_ENGAGEMENT`, `OUTCOME_SALES`, `OUTCOME_AWARENESS`,
 *                 `OUTCOME_TRAFFIC`, `OUTCOME_APP_PROMOTION`, `LINK_CLICKS`,
 *                 `VISIT_INSTAGRAM_PROFILE`) — including `UNKNOWN` (any Meta objective string
 *                 `CampaignObjective.ts`'s `parseCampaignObjective` doesn't recognize) — and any
 *                 future one without needing this file touched again.
 *   2. PAUSE    — protects ad spend from being wasted. Takes priority over SCALE/REFRESH/KEEP
 *                 because an ad burning budget with zero conversations, or at a cost above the
 *                 REVIEW ceiling, must stop before any other optimization is considered. (Note:
 *                 PAUSE's "conversations === 0 AND spend > 0" branch cannot co-occur with SCALE,
 *                 since SCALE requires conversations >= 25 — but PAUSE's "rphChat > 22,000"
 *                 branch could in principle coexist with a high-frequency REFRESH signal, and
 *                 cost protection wins.)
 *   3. SCALE    — reward strong performers before considering creative-fatigue REFRESH signals,
 *                 since scaling budget is the highest-value action available.
 *   4. REFRESH  — creative fatigue (frequency >= 3.5) matters even for an ad that is currently
 *                 within the acceptable KEEP cost band, so it is checked before KEEP/REVIEW.
 *   5. KEEP
 *   6. REVIEW   — also the terminal fallback: an ad with zero spend and zero conversations
 *                 (rphChat undefined, not caught by any rule above) is left for human REVIEW
 *                 rather than silently defaulting to KEEP or PAUSE.
 */
export function evaluateVerdict(input: VerdictEngineInput): Verdict {
  const raw = computeRawVerdict(input);
  return applyLearningPhaseSuppression(raw, input.learningStatus);
}

function computeRawVerdict(input: VerdictEngineInput): Verdict {
  if (input.objective !== CampaignObjective.OUTCOME_LEADS) {
    return Verdict.FIX;
  }

  const zeroConversationWaste = input.conversations === 0 && input.spendAmount > 0;
  if (input.rphChat.isAbove(REVIEW_MAX_IDR) || zeroConversationWaste) {
    return Verdict.PAUSE;
  }

  if (
    input.rphChat.isAtMost(SCALE_THRESHOLD_IDR) &&
    input.conversations >= SCALE_MIN_CONVERSATIONS
  ) {
    return Verdict.SCALE;
  }

  if (input.frequency >= REFRESH_FREQUENCY_THRESHOLD) {
    return Verdict.REFRESH;
  }

  if (input.rphChat.isAtMost(KEEP_THRESHOLD_IDR)) {
    return Verdict.KEEP;
  }

  return Verdict.REVIEW;
}

/**
 * AAOS Samantha Professional Optimizer, Part A — real Meta professional practice: an adset still in
 * Learning Phase should not be PAUSEd for underperformance (pausing resets Meta's own
 * delivery-algorithm calibration, wasting the spend already invested in reaching statistical
 * significance), and should not be SCALEd either (a real, deliberate budget-scale action ALSO resets
 * Meta's learning phase — same root cause, same fix). Only `"LEARNING"` triggers suppression —
 * `"LEARNING_LIMITED"` (Meta's real signal for an adset persistently short of the data it needs,
 * not an active, still-progressing calibration window) is a materially different real situation
 * this dispatch does NOT extend the same "don't disturb it yet" reasoning to without further,
 * separate verification; it is intentionally left to fall through to the raw verdict unchanged, same
 * as `"SUCCESS"`/`undefined`.
 *
 * PAUSE degrades to REVIEW (a real, pre-existing member of this file's own verdict vocabulary — "an
 * ad that needs a human look, not an automatic action" is exactly what REVIEW already means here) so
 * a genuinely wasteful-looking ad still surfaces for a human to look at, it just isn't
 * auto-paused. SCALE degrades to KEEP (also pre-existing) — the ad performed well enough NOT to
 * touch, but real professional practice says don't push more budget at it while its own delivery
 * calibration is still stabilizing.
 */
function applyLearningPhaseSuppression(
  verdict: Verdict,
  learningStatus: LearningStatus | undefined,
): Verdict {
  if (learningStatus !== "LEARNING") {
    return verdict;
  }
  if (verdict === Verdict.PAUSE) {
    return Verdict.REVIEW;
  }
  if (verdict === Verdict.SCALE) {
    return Verdict.KEEP;
  }
  return verdict;
}

/** Real, honest Indonesian explanation for a Learning-Phase-suppressed PAUSE — see `applyLearningPhaseSuppression`'s own doc for the full "why" reasoning. Exported so callers (`PullCampaignData`, and downstream UI/LLM surfaces) can attach the SAME real reason text `getVerdictReason` below already computes, rather than each re-deriving/duplicating it. */
export const LEARNING_PHASE_PAUSE_SUPPRESSED_REASON =
  "Adset masih dalam Learning Phase Meta — jangan di-pause dulu, tunggu keluar dari learning phase (butuh ~50 konversi/minggu) sebelum evaluasi performa sebenarnya.";

/** Real, honest Indonesian explanation for a Learning-Phase-suppressed SCALE — see `applyLearningPhaseSuppression`'s own doc. */
export const LEARNING_PHASE_SCALE_SUPPRESSED_REASON =
  "Adset masih dalam Learning Phase Meta — jangan naikkan budget dulu, scaling budget sekarang akan me-reset kalibrasi learning phase Meta dan membuang progres yang sudah ada.";

/**
 * Companion to `evaluateVerdict` — returns the real, honest reason text explaining WHY the verdict
 * differs from what the raw thresholds alone would have produced, or `undefined` when no
 * suppression applied (the overwhelming majority of ads: `learningStatus` is `undefined`/`"SUCCESS"`/
 * `"LEARNING_LIMITED"`, or it IS `"LEARNING"` but the raw verdict wasn't PAUSE/SCALE to begin with).
 * Deliberately a SEPARATE function rather than changing `evaluateVerdict`'s own return type — every
 * pre-existing call site/test calls `evaluateVerdict` expecting a bare `Verdict` back (see this
 * file's own pre-existing test suite), so widening that return shape would be a breaking change to
 * every one of them for a reason string only the Learning-Phase-suppressed minority of calls
 * actually needs.
 */
export function getVerdictReason(input: VerdictEngineInput): string | undefined {
  if (input.learningStatus !== "LEARNING") {
    return undefined;
  }
  const raw = computeRawVerdict(input);
  if (raw === Verdict.PAUSE) {
    return LEARNING_PHASE_PAUSE_SUPPRESSED_REASON;
  }
  if (raw === Verdict.SCALE) {
    return LEARNING_PHASE_SCALE_SUPPRESSED_REASON;
  }
  return undefined;
}

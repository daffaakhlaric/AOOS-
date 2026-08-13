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
 *                 (`OUTCOME_ENGAGEMENT`, `OUTCOME_SALES`, `LINK_CLICKS`,
 *                 `VISIT_INSTAGRAM_PROFILE`) and any future one without needing this file
 *                 touched again.
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

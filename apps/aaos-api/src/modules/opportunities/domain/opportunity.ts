import { Verdict } from "@aos/meta-ads-connector";

import type { SamanthaDecision } from "../../campaign-health/domain/decision.js";
import type { AnglePerformanceResult } from "../../creative-memory/domain/angle-performance.js";

/**
 * EYVRA — SAMANTHA V2 Phase 9 (Opportunity Engine). Pure, deterministic, total detectors over
 * ALREADY-COMPUTED Phase 4 (`SamanthaDecision`) / Phase 2 (`AnglePerformanceResult[]`) outputs — no
 * I/O, same discipline `signal-engine.ts`/`decision.ts` already establish for their own domain
 * layers.
 *
 * SCOPE NOTE — read before adding a new `OpportunityType`: the raw spec's "Opportunity Engine"
 * (PROMPT 30) sketches ~4-5 opportunity types — `RETARGETING_OPPORTUNITY`, `PLACEMENT_EXPANSION`,
 * `NEW_CAMPAIGN_OPPORTUNITY`, `BUDGET_REALLOCATION` — on top of a scaling-style finding. This
 * codebase can only honestly support the two below TODAY:
 *  - `RETARGETING_OPPORTUNITY` would need a real pixel/retargeting-audience data source. None
 *    exists in this codebase yet (no `meta_pixel_events`/custom-audience table anywhere under
 *    `apps/aaos-api/src`), so this type would have to be fabricated from nothing.
 *  - `PLACEMENT_EXPANSION` would need real per-placement breakdown data (feed vs. reels vs.
 *    audience network, etc.). `meta_insights_daily` (`050_meta_sync.sql`) stores only campaign-level
 *    daily totals, no placement dimension.
 *  - `NEW_CAMPAIGN_OPPORTUNITY` would need a full account-wide campaign list with a "whitespace"
 *    notion (audiences/objectives not yet covered by any real campaign) — no such assembly exists
 *    anywhere in this codebase today.
 *  - `BUDGET_REALLOCATION` would need a real account-wide, multi-campaign performance comparison —
 *    this module (like `CampaignHealthService.assess`) only ever looks at ONE campaign per call.
 * Each of these is a real, future, separately-scoped phase once its real data source exists — never
 * silently invented here. `SCALING_OPPORTUNITY` and `CREATIVE_WINNER_EXPANSION` are the two honest
 * exceptions: both are derivable, TODAY, purely from data this codebase already computes elsewhere.
 */
export type OpportunityType = "SCALING_OPPORTUNITY" | "CREATIVE_WINNER_EXPANSION";

export interface Opportunity {
  readonly type: OpportunityType;
  readonly confidence: number;
  /** Indonesian, human-readable — references the real campaign/angle this opportunity is about. */
  readonly description: string;
  /** Indonesian, references real numbers (CPL, confidence %, etc) — never vague language. */
  readonly evidence: string;
}

/**
 * "High confidence" cut point reused verbatim from `automation-policy/domain/policy-engine.spec.ts`'s
 * own `minimumConfidence: 0.7` fixture value — no separate "high confidence" constant exists yet
 * anywhere in this codebase to import, but `0.7` is the concrete number this codebase's other
 * confidence-gated logic already treats as the "trustworthy enough to act on automatically" bar
 * (`PolicyEngine`'s AUTONOMOUS-mode auto-action gate). Reusing it here keeps this module's own
 * "confident enough to surface as a real, actionable positive finding" bar consistent with that
 * precedent rather than inventing an unrelated number.
 */
export const SCALING_OPPORTUNITY_MIN_CONFIDENCE = 0.7;

/**
 * Fires ONLY when `decision.decision === Verdict.SCALE` (Phase 4's `decideNextAction` sets this from
 * a real `CTR_IMPROVEMENT`/`CPL_IMPROVEMENT` root cause — see `decision.ts`'s `ROOT_CAUSE_DECISIONS`)
 * AND `decision.confidence >= SCALING_OPPORTUNITY_MIN_CONFIDENCE`. Any other `RecommendedActionType`
 * (including `Verdict.SCALE` below the confidence bar) returns `undefined` — this is a single-
 * campaign, at-most-one-real-finding detector, not a list.
 */
export function detectScalingOpportunity(
  campaignId: string,
  decision: SamanthaDecision,
): Opportunity | undefined {
  if (decision.decision !== Verdict.SCALE) {
    return undefined;
  }
  if (decision.confidence < SCALING_OPPORTUNITY_MIN_CONFIDENCE) {
    return undefined;
  }

  const confidencePercent = String(Math.round(decision.confidence * 100));
  return {
    type: "SCALING_OPPORTUNITY",
    confidence: decision.confidence,
    description: `Campaign ${campaignId} menunjukkan sinyal performa positif yang kuat (confidence ${confidencePercent}%) — pertimbangkan untuk scaling budget.`,
    evidence: `Keputusan Samantha untuk campaign ini adalah SCALE dengan confidence ${confidencePercent}% (root cause: ${decision.primaryDiagnosis ?? "tidak diketahui"}). ${decision.reason}`,
  };
}

/**
 * Fires for EVERY angle with `rank === 1` (Phase 2's `rankAnglePerformance` only ever assigns
 * `rank === 1` to the single best real-CPL angle among angles with `dataSufficiency.level >=
 * "MEDIUM"` — see `angle-performance.ts`). Since `rankAnglePerformance` assigns at most one `1` per
 * ranking, `angles` (a tenant-wide list, potentially spanning multiple independent rankings passed
 * in by a caller) could in principle carry more than one `rank === 1` entry — this function makes no
 * assumption about that and simply returns every angle it finds at `rank === 1`, in the order
 * `angles` provides them. Returns `[]` — a real, honest empty result, never `undefined` — when no
 * angle qualifies (e.g. every angle is unranked from insufficient data).
 */
export function detectCreativeWinnerOpportunities(
  angles: readonly AnglePerformanceResult[],
): readonly Opportunity[] {
  const winners = angles.filter((angle) => angle.rank === 1);

  return winners.map((angle) => {
    const cpl = angle.aggregated.cpl;
    const cplText = cpl === undefined ? "tidak diketahui" : `Rp${String(Math.round(cpl))}`;
    return {
      type: "CREATIVE_WINNER_EXPANSION" as const,
      // Reuses the angle's own real `dataSufficiency.score` (0-100, see `data-sufficiency.ts`) as
      // this opportunity's confidence — an honest proxy for "how much real data backs this rank 1",
      // rather than a fabricated flat `1` for every winner regardless of how thin its data is.
      confidence: angle.dataSufficiency.score / 100,
      description: `Angle "${angle.angle}" adalah performer terbaik saat ini (rank 1) — pertimbangkan meminta lebih banyak variasi creative dengan angle ini ke Kai.`,
      evidence: `Angle "${angle.angle}" memiliki CPL ${cplText} dari ${String(angle.packageCount)} creative package dengan data sufficiency ${angle.dataSufficiency.level}.`,
    };
  });
}

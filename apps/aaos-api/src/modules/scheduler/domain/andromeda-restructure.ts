import type { CreativeDiversityScore } from "@aos/meta-ads-connector";

/**
 * `evaluateAndromedaRestructureCandidate` (Samantha Andromeda-Aware Campaign System, Sprint 1) —
 * pure, synchronous, no I/O, the SAME "pure decision function over already-computed signals" shape
 * `evaluateFatigue`/`evaluateNeedCreative` (this module's own siblings) already establish.
 *
 * REAL, NON-NEGOTIABLE SAFETY PROPERTY (per the user's own explicit, direct decision — see this
 * dispatch's own coordinator note): this function NEVER decides to execute anything. Its only
 * output is `{triggered: boolean; reason?}` — "does this campaign look like a real Andromeda-style
 * consolidation candidate" — the SAME shape `evaluateNeedCreative` already uses for its own
 * "should we even consider a guardrail" first step. Unlike `decideCreativeBriefGuardrail`/
 * `decideCampaignPublishGuardrail` (which CAN return an auto-executing `DRAFT`/`ACTIVE` status
 * depending on mode/toggles), there is deliberately NO such branch here: every real trigger from
 * this function — regardless of tenant mode, regardless of any toggle — routes to exactly ONE real
 * outcome in `SchedulerService.runAndromedaRestructureCheck`: enqueue a `RESTRUCTURE_CAMPAIGN`
 * `pending_agent_actions` row for mandatory human review. Restructuring a LIVE campaign (pausing ad
 * sets, moving budget) is real money movement with no reliable, safe, honest reverse operation —
 * this sprint's own coordinator note is explicit that NO circumstance auto-executes it. See
 * `PendingActionsService.approve()`'s own doc and its "SAFETY DEFAULT" test for the other half of
 * this guarantee (only a human's real Approve click can ever invoke the real Meta mutation).
 *
 * The two real signals this function combines:
 *   1. `adSetCount` — Andromeda's own real practical point is specifically about AD-SET
 *      fragmentation ("many narrowly-targeted ad sets" vs. "one ad set, many diverse creatives") —
 *      a campaign with only 1 ad set cannot be "fragmented", so it is never a candidate regardless
 *      of its diversity score.
 *   2. `diversity` — `scoreCreativeDiversity`'s own real, honest output (`@aos/meta-ads-connector`).
 *      `NOT_ENOUGH_DATA`/`DIVERSE` never trigger — only a CONFIRMED `LOW_DIVERSITY` does (never a
 *      missing/undefined signal fabricated into a trigger, matching this whole module's "never
 *      fabricate a decision from missing data" discipline).
 */

/**
 * A campaign is only a real ad-set-fragmentation concern once it has at least this many real ad
 * sets — judgment call, documented the same way `MIN_ADS_FOR_DIVERSITY_SCORE` is: a single ad set
 * cannot be "fragmented" across ad sets by definition.
 */
export const MIN_AD_SETS_FOR_RESTRUCTURE_CANDIDATE = 2;

export interface AndromedaRestructureSignals {
  /** Real, current count of `AdStatus.ACTIVE`-or-not ad sets on the matched campaign (every ad set Meta reports, not just active ones — a paused ad set still represents real fragmentation history). */
  readonly adSetCount: number;
  /** Real, already-computed `scoreCreativeDiversity` output for this campaign's ads. */
  readonly diversity: CreativeDiversityScore;
}

export interface AndromedaRestructureEvaluation {
  readonly triggered: boolean;
  /** Real, honest, human-readable reasoning — always references the real numbers behind the trigger, omitted when `triggered` is `false`. */
  readonly reason?: string;
}

export function evaluateAndromedaRestructureCandidate(
  signals: AndromedaRestructureSignals,
): AndromedaRestructureEvaluation {
  const { adSetCount, diversity } = signals;

  if (adSetCount < MIN_AD_SETS_FOR_RESTRUCTURE_CANDIDATE) {
    return { triggered: false };
  }

  if (diversity.status !== "LOW_DIVERSITY") {
    return { triggered: false };
  }

  return {
    triggered: true,
    reason:
      `Campaign ini punya ${String(adSetCount)} ad set (fragmentasi audience) DAN diversity ` +
      `kreatif rendah — ${diversity.reasoning} Gaya Andromeda: konsolidasi ke 1 ad set dengan ` +
      "kreatif lebih diverse berpotensi lebih efektif daripada mempertahankan banyak ad set " +
      "sempit. Butuh review manusia sebelum restructure real dijalankan.",
  };
}

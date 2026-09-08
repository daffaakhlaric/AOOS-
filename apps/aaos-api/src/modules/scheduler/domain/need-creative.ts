import { Verdict } from "@aos/meta-ads-connector";

import type { FatigueStatus } from "./fatigue.js";

/**
 * `evaluateNeedCreative` (AAOS LOOP UPGRADE, Sprint 8a — Prompt 19 Step 2) — pure, synchronous, no
 * I/O, the SAME "pure decision function over already-computed signals" shape `evaluateFatigue`
 * (`fatigue.ts`) already establishes for this module. Additive: this function does NOT touch
 * `@aos/meta-ads-connector`'s `VerdictEngine`/`@aos/meta-ads-agent`'s `VerdictDecisionEngine` (both
 * documented elsewhere in this session's history as "hard-constrained, already-shipped,
 * independently-verified packages this session generally avoids invasively modifying") — it is a
 * new, separate function that CONSUMES a real, already-computed `Verdict` value as one of its
 * inputs, exactly the same relationship `evaluateFatigue` has to `matchActiveCampaignForListing`'s
 * real `frequency` signal.
 *
 * The spec's own literal condition:
 *   NEED_CREATIVE dipicu kalau:
 *     a) Verdict SCALE/FIX tapi tidak ada asset NORMAL yang cocok untuk angle yang direkomendasikan,
 *        ATAU
 *     b) Asset yang lagi dipakai campaign itu berstatus FATIGUED
 *
 * REAL, HONEST DEGRADE THIS FUNCTION'S SHAPE REFLECTS (investigated directly against this app's
 * real data before writing this):
 *
 * Condition (a) — "tidak ada asset NORMAL yang cocok untuk angle yang direkomendasikan": this app
 * has no real "recommended angle" concept computed anywhere at the per-listing verdict-check call
 * site (`SchedulerService.runPropertyCampaignTriggerCheck`) — `src/lib/kaiRecommendations.ts`'s
 * real angle-recommendation logic runs client-side, at BRIEF-CREATION time, keyed off a specific
 * manual brief draft, not as a standing per-listing recommendation the scheduler could read. This
 * function therefore honestly degrades condition (a) to "does this listing have ANY real
 * `creative_packages` row whose `fatigueStatus` is `NORMAL`" (angle-agnostic) rather than fabricate
 * an angle-matching check with no real data behind it — `hasNormalAsset` is exactly that real,
 * listing-scoped signal, computed by the caller from the SAME `creative_packages` rows
 * `runFatigueCheck` already loads for this listing.
 *
 * Condition (b) — directly reuses `evaluateFatigue`'s own real `FatigueStatus` output for the asset
 * currently in use by the listing's matched active campaign, no further degrade needed. Per
 * `fatigue.ts`'s own doc, `FATIGUED` can never actually be reached from real data today (this app
 * has no CTR time series) — so this condition is fully real/tested but, like `evaluateFatigue`'s
 * own `FATIGUED` branch, will not fire from any real scheduler run until this app gains a real CTR
 * time series. It activates the instant that happens, with zero further code change here.
 *
 * `undefined` inputs are a first-class, honest state (verdict data unavailable, or no
 * `creative_packages` row exists yet for this listing at all) — NEVER treated as "trigger" by
 * default. A trigger only fires from a real, confirmed `false`/`"FATIGUED"` value, matching this
 * whole module's "never fabricate a decision from missing data" discipline.
 */

/** The 2 real `Verdict` members condition (a) cares about — `SCALE` (scale up spend) or `FIX` (creative/targeting needs fixing), the spec's own literal pair. */
const RELEVANT_VERDICTS: readonly Verdict[] = [Verdict.SCALE, Verdict.FIX];

export interface NeedCreativeSignals {
  /**
   * The real, dominant `Verdict` for the listing's matched active campaign's ads (an ad's own
   * already-computed `.verdict`, per `matchActiveCampaignForListing`'s real per-ad values) —
   * `undefined` when no matched campaign/ad has a verdict to report (e.g. no active campaign
   * matched at all).
   */
  readonly verdict?: Verdict;
  /**
   * Real, listing-scoped signal: does at least one real `creative_packages` row for this listing
   * currently have `fatigueStatus === "NORMAL"`? `undefined` when this listing has NO
   * `creative_packages` rows at all yet (never fabricated as `false` — "no asset exists" is a
   * different real state than "an asset exists and it's not NORMAL").
   */
  readonly hasNormalAsset?: boolean;
  /**
   * The real `FatigueStatus` (`evaluateFatigue`'s own output) of the asset(s) currently in use by
   * this listing's matched campaign — `undefined` when no matched package/fatigue signal exists for
   * this listing.
   */
  readonly inUseFatigueStatus?: FatigueStatus;
}

export interface NeedCreativeEvaluation {
  readonly triggered: boolean;
  /** Real, honest, human-readable reasoning — always references which real condition fired, or omitted when `triggered` is `false`. */
  readonly reason?: string;
}

export function evaluateNeedCreative(signals: NeedCreativeSignals): NeedCreativeEvaluation {
  const { verdict, hasNormalAsset, inUseFatigueStatus } = signals;

  // Condition (a) — Verdict SCALE/FIX AND a real, confirmed absence of a NORMAL asset for this
  // listing. `hasNormalAsset === false` is required explicitly (not falsy) — `undefined` (no real
  // creative_packages row exists yet to check) can never honestly confirm "tidak ada asset NORMAL".
  if (verdict !== undefined && RELEVANT_VERDICTS.includes(verdict) && hasNormalAsset === false) {
    return {
      triggered: true,
      reason: `Verdict ${verdict} untuk listing ini, tapi tidak ada creative asset berstatus NORMAL yang bisa dipakai — perlu brief kreatif baru.`,
    };
  }

  // Condition (b) — the asset currently in use is FATIGUED (real `evaluateFatigue` output; see this
  // module's own doc for why this can never fire from real data today, only once a real CTR time
  // series exists).
  if (inUseFatigueStatus === "FATIGUED") {
    return {
      triggered: true,
      reason: "Asset yang sedang dipakai campaign ini berstatus FATIGUED — perlu refresh kreatif.",
    };
  }

  return { triggered: false };
}

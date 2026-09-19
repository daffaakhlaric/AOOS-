import {
  assessDataSufficiency,
  type DataSufficiencyLevel,
} from "../../metric-snapshot/domain/data-sufficiency.js";

/**
 * One variant's real, pulled Rp/lead — `rphLead: null` means "no leads yet", per
 * `@aos/meta-ads-connector`'s `Rph` (division-by-zero-safe, never a fabricated rate).
 *
 * `impressions`/`clicks` (EYVRA Phase 35, PROMPT 27 "Experiment Engine") were added alongside the
 * original `spend`/`leads`/`rphLead` fields solely to feed `assessVariantSufficiency` below — every
 * existing caller (`AbTestingService.monitorRunningTests`) already reads both off the same real
 * `AdMetrics` it was already pulling per variant, so this is not a new I/O dependency.
 */
export interface VariantInsight {
  readonly variantId: string;
  readonly spend: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly leads: number;
  readonly rphLead: number | null;
}

export interface WinnerDecision {
  readonly winnerVariantId: string;
  readonly winnerRphLead: number;
  readonly loserVariantIds: readonly string[];
  readonly runnerUpRphLead: number;
  /** Rounded percentage the winner beats the runner-up's Rp/lead by. */
  readonly improvementPct: number;
}

/** Pure — the spec's threshold check: combined spend across every variant OR days elapsed since the test started. */
export function isThresholdMet(
  totalSpend: number,
  thresholdSpend: number,
  daysRunning: number,
  thresholdDays: number,
): boolean {
  return totalSpend >= thresholdSpend || daysRunning >= thresholdDays;
}

/**
 * Pure — the spec's `declareWinner` ranking: lowest real Rp/lead wins, but only once it beats the
 * runner-up by at least `minMarginPct`. Variants with `rphLead === null` (no leads yet) are
 * excluded from ranking — a rate cannot be "the cheapest" when there is no rate at all. Returns
 * `undefined` when fewer than 2 variants have a comparable rate, or when the margin is too thin —
 * both real "keep testing" states, never a forced decision.
 */
export function decideWinner(
  insights: readonly VariantInsight[],
  minMarginPct: number,
): WinnerDecision | undefined {
  const ranked = insights
    .filter((insight): insight is VariantInsight & { rphLead: number } => insight.rphLead !== null)
    .sort((a, b) => a.rphLead - b.rphLead);
  const winner = ranked[0];
  const runnerUp = ranked[1];
  if (winner === undefined || runnerUp === undefined || runnerUp.rphLead <= 0) {
    return undefined;
  }
  const margin = ((runnerUp.rphLead - winner.rphLead) / runnerUp.rphLead) * 100;
  if (margin < minMarginPct) {
    return undefined;
  }
  return {
    winnerVariantId: winner.variantId,
    winnerRphLead: winner.rphLead,
    loserVariantIds: insights
      .filter((insight) => insight.variantId !== winner.variantId)
      .map((insight) => insight.variantId),
    runnerUpRphLead: runnerUp.rphLead,
    improvementPct: Math.round(margin),
  };
}

/** One variant's real per-variant sample-sufficiency verdict — see `assessVariantSufficiency` below. */
export interface VariantSufficiency {
  readonly variantId: string;
  readonly level: DataSufficiencyLevel;
  readonly reasons: readonly string[];
}

/**
 * Pure — PROMPT 27 "Experiment Engine"'s "no premature winner", applied PER VARIANT rather than to
 * the test's combined total. `isThresholdMet` above already gates on combined spend/days across every
 * variant, and `decideWinner`'s `minMarginPct` gates on the RELATIVE gap between the two leading
 * variants — but neither catches a real, concrete failure mode: one variant reaching a big enough
 * spend/margin purely because the OTHER side of the comparison ran up combined spend/days while
 * itself still resting on a tiny, noisy sample (e.g. 1-2 real leads). A single extra lead on a
 * 200-impression variant can flip its Rp/lead by a huge margin — exactly the swings
 * `metric-snapshot/domain/data-sufficiency.ts` already documents as "too early to trust" for angle/
 * asset ranking. This reuses that SAME real `assessDataSufficiency` function (never a second, parallel
 * threshold table) rather than the tenant-wide `RANKABLE_MIN_LEVEL = "MEDIUM"` bar
 * `creative-memory/domain/angle-performance.ts` gates on: a single A/B test variant realistically
 * never reaches 20,000 impressions / 30 leads (`MEDIUM`) at the modest spend levels this app's real
 * `thresholdSpend`/`minMarginPct` are tuned for (see `abtesting-lookalike.md`'s own "Rp 100rb atau 3
 * hari" defaults) — requiring `MEDIUM` here would make the whole feature unable to ever honestly
 * declare a winner. `INSUFFICIENT` is the correct, honestly-calibrated floor for THIS domain: it
 * only blocks a decision while a variant's own real data is too thin for ANY comparison to be
 * meaningful (impressions or days-covered below `data-sufficiency.ts`'s own `INSUFFICIENT_*`
 * thresholds) — it does not demand the same statistical confidence tenant-wide historical ranking
 * does.
 */
export function assessVariantSufficiency(
  insights: readonly VariantInsight[],
  daysRunning: number,
): readonly VariantSufficiency[] {
  return insights.map((insight) => {
    const result = assessDataSufficiency(
      { impressions: insight.impressions, clicks: insight.clicks, leads: insight.leads },
      daysRunning,
    );
    return { variantId: insight.variantId, level: result.level, reasons: result.reasons };
  });
}

/**
 * Pure — true only once EVERY variant has cleared the `INSUFFICIENT` floor (see
 * `assessVariantSufficiency`'s doc) AND there are at least 2 of them to compare. Call this BEFORE
 * `decideWinner` — a test whose combined `isThresholdMet` already passed but whose per-variant
 * sufficiency has not is a real "keep testing" state, same spirit as `decideWinner` returning
 * `undefined` for too-thin a margin, just catching a different real failure mode (see this module's
 * own doc above).
 */
export function isExperimentReadyToDecide(sufficiencies: readonly VariantSufficiency[]): boolean {
  return (
    sufficiencies.length >= 2 &&
    sufficiencies.every((sufficiency) => sufficiency.level !== "INSUFFICIENT")
  );
}

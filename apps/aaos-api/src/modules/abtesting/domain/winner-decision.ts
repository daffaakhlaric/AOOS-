/** One variant's real, pulled Rp/lead — `rphLead: null` means "no leads yet", per `@aos/meta-ads-connector`'s `Rph` (division-by-zero-safe, never a fabricated rate). */
export interface VariantInsight {
  readonly variantId: string;
  readonly spend: number;
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

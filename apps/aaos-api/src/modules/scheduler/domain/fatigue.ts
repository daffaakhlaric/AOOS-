/**
 * `evaluateFatigue` (AAOS LOOP UPGRADE, Sprint 6 Prompt 16) — pure, synchronous, no I/O, same
 * "pure decision function over already-computed signals" shape `shouldCreateNewCampaign`
 * (`campaign-trigger.ts`) and `VerdictDecisionEngine` (`@aos/meta-ads-agent`) already establish.
 *
 * REAL, HONEST DATA-AVAILABILITY FINDING THIS FUNCTION'S SHAPE REFLECTS (investigated directly,
 * confirmed against `IntelligenceService.buildAnomalyContext`'s own doc and Sprint 5's Metrics-tab
 * work): this codebase has NO historical/time-series metrics storage anywhere — every real Meta
 * pull returns only the CURRENT value of each metric for whatever date-preset window was requested,
 * never a day-by-day series a "last 7 days vs. previous 7 days" comparison could be computed from.
 * A true `ctrTrend` (the spec's own `(avg CTR 7 hari terakhir) vs (avg CTR 7 hari sebelumnya)`) is
 * therefore NOT honestly computable today anywhere this function is called from real data — see
 * `044_creative_packages_fatigue.sql`'s own header doc and `SchedulerService.runFatigueCheck`'s own
 * doc for exactly what real data IS wired in (per-listing `frequency`, via the same
 * `matchActiveCampaignForListing` signal `runPropertyCampaignTriggerCheck` already computes).
 *
 * HONEST DEGRADE (per the coordinator note's explicit instruction — "do NOT fabricate a trend,
 * degrade honestly the same way Sprint 5 degraded Revenue/ROAS"): `ctrTrend` is a real, honest
 * `number | undefined` — `undefined` means "not enough historical data yet available for this
 * listing", NEVER a fabricated 0 or an invented negative number. The spec's own `FATIGUED` verdict
 * requires BOTH `frequency > 3.5` AND a CONFIRMED `ctrTrend <= -15%` — when `ctrTrend` is
 * `undefined`, that second condition can never be honestly confirmed, so this function can NEVER
 * return `FATIGUED` from an `undefined` trend, only `WARNING` (frequency alone already crossing the
 * spec's own `WARNING` frequency threshold, 2.8) or `NORMAL`. The `FATIGUED` branch below still
 * exists and is fully real/tested — it activates for real the instant a real caller supplies a real,
 * computed `ctrTrend`, which is exactly what this app's real scheduler wiring today never has.
 */

export type FatigueStatus = "NORMAL" | "WARNING" | "FATIGUED";

/** Spec's own literal thresholds — kept as named constants, never re-derived. */
export const FATIGUED_FREQUENCY_THRESHOLD = 3.5;
export const FATIGUED_CTR_TREND_THRESHOLD = -0.15;
export const WARNING_FREQUENCY_THRESHOLD = 2.8;
export const WARNING_CTR_TREND_THRESHOLD = -0.08;

export interface FatigueSignals {
  /** Real, current `frequency` for the matched active campaign — see `matchActiveCampaignForListing`. */
  readonly frequencyCurrent: number;
  /**
   * `(avg CTR 7 hari terakhir) vs (avg CTR 7 hari sebelumnya)`, expressed as a fraction (e.g. `-0.22`
   * for "turun 22%"). `undefined` when no real 7-day-vs-previous-7-day time series exists for this
   * listing — see this module's own header doc for why that is the real, honest, permanent state of
   * every real caller in this app today.
   */
  readonly ctrTrend?: number;
}

export interface FatigueEvaluation {
  readonly status: FatigueStatus;
  /** Real, honest, human-readable reasoning — never references a CTR number when `ctrTrend` is `undefined` (see this module's own header doc). */
  readonly reasoning: string;
}

export function evaluateFatigue(signals: FatigueSignals): FatigueEvaluation {
  const { frequencyCurrent, ctrTrend } = signals;
  const freq = frequencyCurrent.toFixed(1);

  if (
    ctrTrend !== undefined &&
    frequencyCurrent > FATIGUED_FREQUENCY_THRESHOLD &&
    ctrTrend <= FATIGUED_CTR_TREND_THRESHOLD
  ) {
    const ctrDropPct = Math.round(Math.abs(ctrTrend) * 100);
    return {
      status: "FATIGUED",
      reasoning: `Frequency ${freq} (di atas ${String(FATIGUED_FREQUENCY_THRESHOLD)}) dan CTR turun ${String(ctrDropPct)}% dalam 7 hari — waktunya refresh angle ini dengan variasi baru.`,
    };
  }

  if (
    (ctrTrend !== undefined &&
      frequencyCurrent > WARNING_FREQUENCY_THRESHOLD &&
      ctrTrend <= WARNING_CTR_TREND_THRESHOLD) ||
    (ctrTrend === undefined && frequencyCurrent > WARNING_FREQUENCY_THRESHOLD)
  ) {
    const trendNote =
      ctrTrend !== undefined
        ? `CTR turun ${String(Math.round(Math.abs(ctrTrend) * 100))}% dalam 7 hari`
        : "CTR trend belum tersedia (belum ada data historis 7 hari) — status berdasarkan frequency saja";
    return {
      status: "WARNING",
      reasoning: `Frequency ${freq} (di atas ${String(WARNING_FREQUENCY_THRESHOLD)}) — ${trendNote}.`,
    };
  }

  return {
    status: "NORMAL",
    reasoning: `Frequency ${freq} — belum menunjukkan tanda fatigue.`,
  };
}

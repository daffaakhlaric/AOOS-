/**
 * EYVRA — SAMANTHA V2 Phase 1 Part B (second half). Pure, deterministic "reverse funnel" math for
 * one Growth Objective: given a real target Hot Lead count and a tenant's REAL historical
 * raw-lead/hot-lead counts (over some lookback window the caller — `GrowthObjectivesService.analyze`
 * — chooses and documents), project how many raw leads/how much media spend are honestly required.
 *
 * No I/O here — every input is already-fetched real data (`GrowthMetricsRepository` for the counts,
 * `MetricSnapshotService`/`resolveBenchmark` for `historicalCplIdr`). This mirrors the same
 * "pure domain function over already-fetched rows" shape `aggregate-insights.ts`/`data-sufficiency.ts`/
 * `benchmark.ts` already establish for this phase's other math.
 *
 * NEVER FABRICATE FROM ZERO: `historicalRawLeads === 0` means this tenant has no real lead volume
 * to project from — `conversionRate`/`estimatedRequiredRawLeads`/`estimatedMediaSpendIdr` are all
 * `undefined` and `confidence` is `0` in that case, never a guessed number.
 */

export interface ReverseFunnelInput {
  readonly targetHotLeads: number;
  /** Real count of raw leads created over some real lookback window — see caller's own doc for which window. */
  readonly historicalRawLeads: number;
  /** Real count of those same leads that `evaluateHotLead` classifies as hot, over the SAME window. */
  readonly historicalHotLeads: number;
  /** Real cost-per-(raw)-lead from a trustworthy `BenchmarkResult` (`confidence` at least `MEDIUM`) — `undefined` when no trustworthy benchmark exists yet. */
  readonly historicalCplIdr?: number;
}

export interface EstimatedRange {
  readonly min: number;
  readonly expected: number;
  readonly max: number;
}

export interface ReverseFunnelResult {
  /** `historicalHotLeads / historicalRawLeads`. `undefined` when `historicalRawLeads === 0` (never divide by zero). Can exceed `1.0` — see this file's `computeConversionRate` doc for the honest reason that's allowed to happen, not clamped away. */
  readonly conversionRate?: number;
  /** `undefined` whenever `conversionRate` is `undefined` OR `conversionRate === 0` (a real 0% historical conversion rate makes "raw leads required" mathematically infinite — an honest gap, not a number to fabricate). */
  readonly estimatedRequiredRawLeads?: EstimatedRange;
  /** `undefined` whenever `estimatedRequiredRawLeads` is `undefined` OR `historicalCplIdr` is `undefined` — spend can never be estimated without both a real required-lead count AND a real cost basis. */
  readonly estimatedMediaSpendIdr?: EstimatedRange;
  /** `0`-`1`, a real deterministic function of historical sample size (see `computeConfidence`) — `0` exactly when `historicalRawLeads === 0`. */
  readonly confidence: number;
}

/**
 * Sample-size caps beyond which more historical data stops meaningfully increasing confidence —
 * same "graduated, capped component" shape `data-sufficiency.ts`'s `computeScore` already
 * establishes for `impressions`/`leads`/`daysCovered`, applied here to raw/hot LEAD counts instead
 * of ad-metric counters. `RAW_LEADS_CONFIDENCE_CAP` carries the larger 70% weight because raw-lead
 * volume is what makes `historicalRawLeads` itself a stable denominator; `HOT_LEADS_CONFIDENCE_CAP`
 * carries the remaining 30% because a conversion RATE computed from very few hot leads (e.g. 1 hot
 * lead out of 3 raw leads = 33%) is noisy even when raw volume is healthy.
 */
export const RAW_LEADS_CONFIDENCE_CAP = 200;
export const HOT_LEADS_CONFIDENCE_CAP = 20;
const RAW_LEADS_CONFIDENCE_WEIGHT = 0.7;
const HOT_LEADS_CONFIDENCE_WEIGHT = 0.3;

/** `0` at `historicalRawLeads === 0`; otherwise a weighted, capped blend of raw-lead and hot-lead sample size, rounded to 2 decimals. */
function computeConfidence(historicalRawLeads: number, historicalHotLeads: number): number {
  if (historicalRawLeads === 0) {
    return 0;
  }
  const rawComponent =
    Math.min(historicalRawLeads / RAW_LEADS_CONFIDENCE_CAP, 1) * RAW_LEADS_CONFIDENCE_WEIGHT;
  const hotComponent =
    Math.min(historicalHotLeads / HOT_LEADS_CONFIDENCE_CAP, 1) * HOT_LEADS_CONFIDENCE_WEIGHT;
  return Math.round((rawComponent + hotComponent) * 100) / 100;
}

/**
 * Real division, `undefined` only for the true zero-denominator case. Deliberately NOT clamped at
 * `1.0` when `historicalHotLeads > historicalRawLeads`: that's a real, if unusual, state a lookback
 * window can produce (e.g. a lead CREATED just before the window boundary converts to hot just
 * inside it, so it counts toward `historicalHotLeads` without its creation counting toward
 * `historicalRawLeads` for this same window). Reporting the true rate (e.g. `1.2`) is more honest
 * than silently capping it — and the downstream math in `computeReverseFunnel` still behaves
 * sensibly: a rate above `1.0` simply means FEWER raw leads are required than the hot-lead target,
 * which is mathematically consistent even though it looks surprising.
 */
function computeConversionRate(
  historicalRawLeads: number,
  historicalHotLeads: number,
): number | undefined {
  if (historicalRawLeads === 0) {
    return undefined;
  }
  return historicalHotLeads / historicalRawLeads;
}

/**
 * Band width (as a fraction of `expected`) around the point estimate — wider for low confidence,
 * narrower for high confidence, a real function of `confidence` rather than one fixed magnitude
 * applied uniformly. At `confidence = 0` the band is `MAX_BAND_PCT` (50%); at `confidence = 1` it
 * narrows to `MIN_BAND_PCT` (10%). Linear interpolation between the two — simple and deterministic,
 * no invented curve.
 */
const MAX_BAND_PCT = 0.5;
const MIN_BAND_PCT = 0.1;

function bandPct(confidence: number): number {
  return MAX_BAND_PCT - (MAX_BAND_PCT - MIN_BAND_PCT) * confidence;
}

function computeRange(expected: number, confidence: number): EstimatedRange {
  const pct = bandPct(confidence);
  const roundedExpected = Math.round(expected);
  return {
    min: Math.max(0, Math.floor(expected * (1 - pct))),
    expected: roundedExpected,
    max: Math.ceil(expected * (1 + pct)),
  };
}

export function computeReverseFunnel(input: ReverseFunnelInput): ReverseFunnelResult {
  const { targetHotLeads, historicalRawLeads, historicalHotLeads, historicalCplIdr } = input;

  const confidence = computeConfidence(historicalRawLeads, historicalHotLeads);
  const conversionRate = computeConversionRate(historicalRawLeads, historicalHotLeads);

  if (conversionRate === undefined || conversionRate === 0) {
    return { conversionRate, confidence };
  }

  const expectedRawLeads = targetHotLeads / conversionRate;
  const estimatedRequiredRawLeads = computeRange(expectedRawLeads, confidence);

  const estimatedMediaSpendIdr =
    historicalCplIdr === undefined
      ? undefined
      : {
          min: Math.round(estimatedRequiredRawLeads.min * historicalCplIdr),
          expected: Math.round(estimatedRequiredRawLeads.expected * historicalCplIdr),
          max: Math.round(estimatedRequiredRawLeads.max * historicalCplIdr),
        };

  return {
    conversionRate,
    estimatedRequiredRawLeads,
    estimatedMediaSpendIdr,
    confidence,
  };
}

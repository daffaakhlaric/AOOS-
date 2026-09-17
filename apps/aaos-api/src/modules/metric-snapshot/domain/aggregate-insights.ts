/**
 * EYVRA — SAMANTHA V2 Phase 1 Part B (first half). Pure summation + derivation over a window's raw
 * `meta_insights_daily` rows (`050_meta_sync.sql`) — no I/O.
 *
 * WHY DERIVED, NOT AVERAGED: `meta_insights_daily` stores `ctr`/`cpm`/`cpc`/`cpl`/`frequency` as
 * PER-DAY values already computed by Meta for that single day. Averaging those per-day ratios
 * across a multi-day window is mathematically wrong (a day with 10 impressions and 100% CTR would
 * weigh exactly as much as a day with 100,000 impressions and 1% CTR). This module instead sums
 * the raw counters (`spend`/`impressions`/`clicks`/`reach`/`leads`) first, then derives each ratio
 * from those sums — the statistically correct way to combine a multi-day window.
 *
 * HONEST LIMITATION — `frequency`: Meta's real `reach` is DEDUPLICATED across the whole requested
 * window (a person who saw an ad on both Monday and Tuesday counts once in a real 2-day `reach`).
 * `meta_insights_daily` only ever stores PER-DAY reach (each day's own dedup, per that day only —
 * see `050_meta_sync.sql`'s `reach BIGINT` column), so summing `reach` across days over-counts
 * anyone reached on more than one day within the window. The `frequency` this function derives
 * (`impressions / reach`, both summed) is therefore a real, honest APPROXIMATION of true window
 * frequency, not an exact figure — it will read slightly LOW relative to Meta's own real window-level
 * frequency for a window that reaches the same people repeatedly. Documented here rather than
 * silently presented as exact.
 */

export interface RawInsightCounters {
  readonly spend: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly reach: number;
  readonly leads: number;
}

export interface AggregatedMetrics {
  readonly spend: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly reach: number;
  readonly leads: number;
  /** `clicks / impressions`. `undefined` (never `NaN`/`0`) when `impressions` is 0. */
  readonly ctr?: number;
  /** `(spend / impressions) * 1000`. `undefined` when `impressions` is 0. */
  readonly cpm?: number;
  /** `spend / clicks`. `undefined` when `clicks` is 0. */
  readonly cpc?: number;
  /** `spend / leads`. `undefined` (never `0`/`Infinity`) when `leads` is 0 — a real 0-lead window has no honest "cost per lead", not a free one. */
  readonly cpl?: number;
  /** `impressions / reach` — see this module's header doc for why summed multi-day `reach` is an approximation, not exact. `undefined` when `reach` is 0. */
  readonly frequency?: number;
}

export function aggregateInsightRows(rows: readonly RawInsightCounters[]): AggregatedMetrics {
  const totals = rows.reduce<{
    spend: number;
    impressions: number;
    clicks: number;
    reach: number;
    leads: number;
  }>(
    (acc, row) => ({
      spend: acc.spend + row.spend,
      impressions: acc.impressions + row.impressions,
      clicks: acc.clicks + row.clicks,
      reach: acc.reach + row.reach,
      leads: acc.leads + row.leads,
    }),
    { spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0 },
  );

  return {
    ...totals,
    ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : undefined,
    cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : undefined,
    cpc: totals.clicks > 0 ? totals.spend / totals.clicks : undefined,
    cpl: totals.leads > 0 ? totals.spend / totals.leads : undefined,
    frequency: totals.reach > 0 ? totals.impressions / totals.reach : undefined,
  };
}

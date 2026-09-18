/**
 * EYVRA — SAMANTHA V2 + KAI V2 Phase 17. Client-safe DTO shapes for
 * `GET /api/v1/creative-memory/angle-performance` — mirrors `apps/aaos-api`'s
 * `AnglePerformanceResponseDto`/`AnglePerformanceResult`/`AggregatedMetrics`/`DataSufficiencyResult`
 * field-for-field (Phase 2's Creative Performance Memory ranking engine). Hand-written, not
 * imported from `apps/aaos-api`, same "never pull a Node-only runtime value into a `\"use client\"`
 * bundle" discipline `campaign-health.types.ts`'s own header doc establishes.
 */

/**
 * `spend`/`impressions`/`clicks`/`reach`/`leads` are real summed counters, always present (`0` when
 * an angle has no real rows). `ctr`/`cpm`/`cpc`/`cpl`/`frequency` are honestly `undefined` — never a
 * fabricated `0`/`NaN` — when their real denominator is `0` (see `aggregate-insights.ts`).
 */
export interface AggregatedMetricsDto {
  readonly spend: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly reach: number;
  readonly leads: number;
  /** `clicks / impressions`. `undefined` when `impressions` is 0. */
  readonly ctr?: number;
  /** `(spend / impressions) * 1000`. `undefined` when `impressions` is 0. */
  readonly cpm?: number;
  /** `spend / clicks`. `undefined` when `clicks` is 0. */
  readonly cpc?: number;
  /** `spend / leads`. `undefined` when `leads` is 0 — a real 0-lead angle has no honest CPL. */
  readonly cpl?: number;
  /** `impressions / reach`, an honest approximation over a multi-day window. `undefined` when `reach` is 0. */
  readonly frequency?: number;
}

export type DataSufficiencyLevelDto = "INSUFFICIENT" | "LOW" | "MEDIUM" | "HIGH";

export interface DataSufficiencyResultDto {
  readonly level: DataSufficiencyLevelDto;
  /** `0`-`100`, a real continuous score. */
  readonly score: number;
  /** Specific, named Indonesian reasons the level isn't higher. Empty at `HIGH`. */
  readonly reasons: readonly string[];
}

export interface AnglePerformanceResultDto {
  /** The real `PropertyAdAngle` (or vertical-equivalent) enum value, e.g. `DP_RINGAN`/`READY_HUNI`/`INVESTASI`. */
  readonly angle: string;
  /** How many distinct, published `creative_packages` carry this angle. */
  readonly packageCount: number;
  readonly aggregated: AggregatedMetricsDto;
  readonly dataSufficiency: DataSufficiencyResultDto;
  /**
   * `1` = best real CPL among angles with `dataSufficiency.level >= "MEDIUM"`. `undefined` for any
   * angle below that bar — reported (never hidden), never force-ranked against a reliable one.
   */
  readonly rank?: number;
}

/**
 * `GET /api/v1/creative-memory/angle-performance` response — a pass-through of the real
 * `AnglePerformanceResponseDto`. The backend's own `rankAnglePerformance` already orders `angles`
 * as ranked-first (real rank ascending), then unranked — no client-side re-sort needed.
 */
export interface AnglePerformanceResponseDto {
  readonly angles: readonly AnglePerformanceResultDto[];
}

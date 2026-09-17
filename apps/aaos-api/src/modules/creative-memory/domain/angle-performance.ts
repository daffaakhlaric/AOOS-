import {
  aggregateInsightRows,
  type AggregatedMetrics,
} from "../../metric-snapshot/domain/aggregate-insights.js";
import {
  assessDataSufficiency,
  type DataSufficiencyLevel,
  type DataSufficiencyResult,
} from "../../metric-snapshot/domain/data-sufficiency.js";
import type { InsightRow } from "../../metric-snapshot/infrastructure/metric-snapshot.repository.js";

/**
 * EYVRA — SAMANTHA V2 + KAI V2 Phase 2 (Creative Performance Memory). Pure grouping + ranking over
 * a `PropertyAdAngle`'s already-linked, already-persisted real `meta_insights_daily` rows — no I/O.
 *
 * `insightRows` is typed as `readonly InsightRow[]` (metric-snapshot's own real `date` + counters
 * shape), not the bare `RawInsightCounters` the raw spec sketch named — `RawInsightCounters` (see
 * `aggregate-insights.ts`) has no `date` field, and `daysCovered` below must be computed honestly
 * from the real distinct dates each angle's rows actually cover (same discipline
 * `MetricSnapshotService.buildSnapshot` already establishes), which is impossible without a `date`
 * on each row. `InsightRow` already IS "`RawInsightCounters` + `date`" — reused verbatim here
 * rather than inventing a second, near-identical interface — and is structurally compatible with
 * `aggregateInsightRows`'s `RawInsightCounters[]` parameter (it only reads the 5 shared counter
 * fields), so no cast or remapping is needed to reuse that function.
 */
export interface PackagePerformanceInput {
  readonly angle: string;
  /** This ONE package's own linked ads' real daily rows (every `meta_ad_id` in its `published_meta_ad_ids`, flattened). */
  readonly insightRows: readonly InsightRow[];
}

export interface AnglePerformanceResult {
  readonly angle: string;
  /** How many distinct `creative_packages` rows (published, real Meta ads) carry this angle. */
  readonly packageCount: number;
  readonly aggregated: AggregatedMetrics;
  readonly dataSufficiency: DataSufficiencyResult;
  /**
   * `1` = best real CPL among angles with `dataSufficiency.level >= "MEDIUM"`. `undefined` for any
   * angle below that bar — an angle with too little data is reported (never hidden) but never
   * force-ranked against a reliable one.
   */
  readonly rank?: number;
}

/** Ordinal so `"MEDIUM"`/`"HIGH"` can be compared against a `"level >= MEDIUM"` bar — `DataSufficiencyLevel` itself is a plain string union, not intrinsically ordered. */
const LEVEL_ORDER: Readonly<Record<DataSufficiencyLevel, number>> = {
  INSUFFICIENT: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};
const RANKABLE_MIN_LEVEL: DataSufficiencyLevel = "MEDIUM";

function isRankable(level: DataSufficiencyLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[RANKABLE_MIN_LEVEL];
}

/**
 * The real CPL-ascending comparator `rankAnglePerformance` sorts its rankable subset with —
 * exported separately (not just inlined in `.sort(...)`) so the zero-lead placement rule below can
 * be unit-tested directly against hand-built `AnglePerformanceResult`s, without needing to first
 * satisfy `assessDataSufficiency`'s own real thresholds. NOTE, verified against
 * `data-sufficiency.ts`: because BOTH its `LOW` and `MEDIUM` gates require `leads` above a nonzero
 * floor (`LOW_LEADS_THRESHOLD`/`MEDIUM_LEADS_THRESHOLD`), an angle whose real summed `leads` is
 * exactly `0` can never itself clear the `"MEDIUM"` rankable bar this module gates on — so this
 * exact comparator branch is not reachable end-to-end through `rankAnglePerformance` with today's
 * real thresholds. It is kept as genuine defensive correctness (never mis-sorts an undefined CPL as
 * "best" if a future threshold change, or a differently-computed sufficiency input, ever makes a
 * zero-lead-but-rankable angle possible) rather than assumed away.
 */
export function compareRankableByCpl(a: AnglePerformanceResult, b: AnglePerformanceResult): number {
  const cplA = a.aggregated.cpl;
  const cplB = b.aggregated.cpl;
  if (cplA === undefined && cplB === undefined) {
    return 0;
  }
  if (cplA === undefined) {
    return 1;
  }
  if (cplB === undefined) {
    return -1;
  }
  return cplA - cplB;
}

/**
 * Groups `packages` by `angle`, sums each angle's real insight rows (`aggregateInsightRows`),
 * assesses each angle's `DataSufficiencyResult` (`assessDataSufficiency`, gated on the angle's real
 * summed sample size + distinct real days covered across ALL its packages' rows), then ranks ONLY
 * the rankable subset (`dataSufficiency.level >= "MEDIUM"`) by real CPL ascending.
 *
 * ZERO-LEAD TIE-BREAK RULE (documented, not incidental): an angle whose summed `leads` is `0` has
 * `aggregated.cpl === undefined` (`aggregate-insights.ts`'s own honest "no fabricated CPL" rule).
 * Such an angle is placed LAST among the rankable set (never first, never omitted) — a real
 * angle that spent money and got zero leads is the worst real outcome a CPL ranking can express,
 * not an undefined/best one. Two zero-lead angles keep their original relative (grouping) order
 * against each other, same as any other real tie.
 */
export function rankAnglePerformance(
  packages: readonly PackagePerformanceInput[],
): readonly AnglePerformanceResult[] {
  const byAngle = new Map<string, PackagePerformanceInput[]>();
  for (const pkg of packages) {
    const existing = byAngle.get(pkg.angle);
    if (existing === undefined) {
      byAngle.set(pkg.angle, [pkg]);
    } else {
      existing.push(pkg);
    }
  }

  const results: AnglePerformanceResult[] = [];
  for (const [angle, anglePackages] of byAngle) {
    const allRows = anglePackages.flatMap((pkg) => pkg.insightRows);
    const aggregated = aggregateInsightRows(allRows);
    const sampleSize = {
      impressions: aggregated.impressions,
      clicks: aggregated.clicks,
      leads: aggregated.leads,
    };
    const daysCovered = new Set(allRows.map((row) => row.date)).size;
    const dataSufficiency = assessDataSufficiency(sampleSize, daysCovered);
    results.push({
      angle,
      packageCount: anglePackages.length,
      aggregated,
      dataSufficiency,
    });
  }

  const rankable = results.filter((result) => isRankable(result.dataSufficiency.level));
  const sortedRankable = [...rankable].sort(compareRankableByCpl);
  const rankByAngle = new Map<string, number>();
  sortedRankable.forEach((result, index) => {
    rankByAngle.set(result.angle, index + 1);
  });

  // Ranked angles first (in real rank order), then unranked ones (insufficient data), each keeping
  // its original grouping-order relative to its own peers — never silently dropped.
  const ranked = sortedRankable.map((result) => ({
    ...result,
    rank: rankByAngle.get(result.angle),
  }));
  const unranked = results.filter((result) => !rankByAngle.has(result.angle));
  return [...ranked, ...unranked];
}

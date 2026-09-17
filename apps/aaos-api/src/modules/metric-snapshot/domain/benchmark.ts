import type { MetricSnapshotDto } from "../dto/metric-snapshot.dto.js";

/**
 * EYVRA — SAMANTHA V2 Phase 1 Part B (first half). Pure benchmark resolution — no I/O; the caller
 * (`../metric-snapshot.service.ts`) is responsible for actually fetching the two real snapshots
 * this function chooses between.
 *
 * REAL, INVESTIGATED SCOPE NARROWING vs. a prior planning doc's full campaign -> adset -> account ->
 * segment -> geo -> objective -> generic hierarchy: this phase implements ONLY 2 real levels —
 * campaign-historical and account-historical, both genuinely backed by `meta_insights_daily` via
 * `MetricSnapshotRepository`. The rest are deliberately deferred, not fabricated:
 *   - adset-level would need a parallel `getAdSetInsightRows` this phase's repository doesn't add
 *     (only campaign-level `getCampaignInsightRows`/`getAccountInsightRows` exist today).
 *   - segment/geo-level would need joining `meta_campaigns.listing_id` -> `listings.property_type`/
 *     `listings.city` — a real, honestly-possible join, but out of scope for this pass.
 *   - a generic/industry-benchmark level does not exist: this codebase has no real external
 *     benchmark data source anywhere (verified — no such table, config, or third-party integration).
 *     `source: "NONE"` is therefore a legitimate, EXPECTED result whenever neither real level has
 *     enough data, never a bug to work around with an invented "typical" number. Callers must
 *     handle `"NONE"`/`confidence: "NONE"` as a real, first-class case (e.g. "not enough history to
 *     compare yet" in the UI), never silently treat a missing benchmark as "0% CTR is bad".
 *
 * A source is only used when its OWN `dataSufficiency.level` is at least `MEDIUM` — an
 * `INSUFFICIENT`/`LOW` historical snapshot is exactly as untrustworthy as a benchmark as it is as a
 * live metric (same reasoning `data-sufficiency.ts` already documents), so it's skipped in favor of
 * the next real fallback rather than handed out as a misleadingly confident number.
 */

export interface BenchmarkContext {
  readonly tenantId: string;
  /** Real `meta_campaign_id`, when benchmarking a specific campaign. Absent for an account-wide benchmark request. */
  readonly campaignId?: string;
}

export interface BenchmarkSources {
  /** e.g. this campaign's own lifetime `MetricSnapshotDto` — absent when there is no matching campaign (or none was requested). */
  readonly campaignHistorical?: MetricSnapshotDto;
  /** The tenant's account-wide lifetime `MetricSnapshotDto`. */
  readonly accountHistorical?: MetricSnapshotDto;
}

export type BenchmarkSource = "CAMPAIGN_HISTORICAL" | "ACCOUNT_HISTORICAL" | "NONE";
export type BenchmarkConfidence = "HIGH" | "MEDIUM" | "LOW" | "NONE";

export interface BenchmarkResult {
  readonly source: BenchmarkSource;
  readonly cpl?: number;
  readonly ctr?: number;
  readonly confidence: BenchmarkConfidence;
}

/** `dataSufficiency.level` -> `BenchmarkConfidence` is a direct, honest mapping — a benchmark can never be more confident than the historical data it was computed from. */
function confidenceOf(snapshot: MetricSnapshotDto): BenchmarkConfidence {
  switch (snapshot.dataSufficiency.level) {
    case "HIGH":
      return "HIGH";
    case "MEDIUM":
      return "MEDIUM";
    default:
      return "NONE";
  }
}

function isUsable(snapshot: MetricSnapshotDto | undefined): snapshot is MetricSnapshotDto {
  return (
    snapshot !== undefined &&
    (snapshot.dataSufficiency.level === "MEDIUM" || snapshot.dataSufficiency.level === "HIGH")
  );
}

export function resolveBenchmark(
  _context: BenchmarkContext,
  sources: BenchmarkSources,
): BenchmarkResult {
  if (isUsable(sources.campaignHistorical)) {
    const snapshot = sources.campaignHistorical;
    return {
      source: "CAMPAIGN_HISTORICAL",
      cpl: snapshot.cpl,
      ctr: snapshot.ctr,
      confidence: confidenceOf(snapshot),
    };
  }

  if (isUsable(sources.accountHistorical)) {
    const snapshot = sources.accountHistorical;
    return {
      source: "ACCOUNT_HISTORICAL",
      cpl: snapshot.cpl,
      ctr: snapshot.ctr,
      confidence: confidenceOf(snapshot),
    };
  }

  return { source: "NONE", confidence: "NONE" };
}

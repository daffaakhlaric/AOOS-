import type { Result } from "@aos/common";
import type { Closing, ClosingStats } from "@aos/lead-store";

import type { ClosingTrackerError } from "../domain/errors/ClosingTrackerError.js";
import type { ReportPeriod } from "../domain/value-objects/ReportPeriod.js";

/**
 * The raw material every other service in this package aggregates from: the period's raw closings
 * (needed for anything `@aos/lead-store`'s own `GetClosingStats` has no concept of — fallback
 * attribution, `BranchPerformance`/`UnitPerformance`/`SalesPerformance`, `ClosingPipeline`) plus
 * `GetClosingStats`'s own `ClosingStats` (reused directly for directly-attributed campaigns' Rp/SPK
 * — coordinator note #1).
 */
export interface ClosingDataset {
  readonly period: ReportPeriod;
  readonly closings: ReadonlyArray<Closing>;
  readonly stats: ClosingStats;
}

/** Contract for `ClosingAggregatorService` — aggregates closing data from `@aos/lead-store` for a period. */
export interface IClosingAggregator {
  aggregate(period: ReportPeriod): Promise<Result<ClosingDataset, ClosingTrackerError>>;
}

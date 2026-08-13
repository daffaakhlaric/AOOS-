import { err, ok, type Result } from "@aos/common";
import type { GetClosingStats, IClosingRepository } from "@aos/lead-store";

import type { IClosingAggregator, ClosingDataset } from "../../contracts/IClosingAggregator.js";
import { ClosingTrackerError } from "../../domain/errors/ClosingTrackerError.js";
import type { ReportPeriod } from "../../domain/value-objects/ReportPeriod.js";

/**
 * Aggregates closing data from `@aos/lead-store` for a period (spec: "ClosingAggregatorService").
 * Calls the real `IClosingRepository.findByFilter` for the raw closings (needed for everything
 * lead-store's own `GetClosingStats` has no concept of — fallback attribution, `BranchPerformance`
 * / `UnitPerformance`/`SalesPerformance`, `ClosingPipeline`) AND the real `GetClosingStats` use
 * case for its `rphSpkByCampaign`/`closingsByCampaign`/`closingsByBranch`/`totalCommissionIdr` —
 * reused verbatim by downstream services rather than re-derived (coordinator note #1). Zero
 * closings in the period is not an error — it resolves to an empty `ClosingDataset`.
 */
export class ClosingAggregatorService implements IClosingAggregator {
  constructor(
    private readonly closingRepository: IClosingRepository,
    private readonly getClosingStats: GetClosingStats,
  ) {}

  async aggregate(period: ReportPeriod): Promise<Result<ClosingDataset, ClosingTrackerError>> {
    const closingsResult = await this.closingRepository.findByFilter({
      fromDate: period.fromDate,
      toDate: period.toDate,
    });
    if (!closingsResult.ok) {
      return err(
        new ClosingTrackerError(
          `ClosingAggregatorService: failed to load closings — ${closingsResult.error.message}`,
          { cause: closingsResult.error },
        ),
      );
    }

    const statsResult = await this.getClosingStats.execute({
      fromDate: period.fromDate,
      toDate: period.toDate,
    });
    if (!statsResult.ok) {
      return err(
        new ClosingTrackerError(
          `ClosingAggregatorService: GetClosingStats failed — ${statsResult.error.message}`,
          { cause: statsResult.error },
        ),
      );
    }

    return ok({
      period,
      closings: closingsResult.value,
      stats: statsResult.value,
    });
  }
}

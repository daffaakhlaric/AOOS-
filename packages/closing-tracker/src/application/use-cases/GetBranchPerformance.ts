import { err, ok, type Result } from "@aos/common";

import type { IReportGenerator } from "../../contracts/IReportGenerator.js";
import type { BranchPerformance } from "../../domain/entities/BranchPerformance.js";
import type { ClosingTrackerError } from "../../domain/errors/ClosingTrackerError.js";
import type { ReportPeriod } from "../../domain/value-objects/ReportPeriod.js";

export interface GetBranchPerformanceInput {
  readonly period: ReportPeriod;
}

/** Per-branch closing stats (spec: "GetBranchPerformance ← per-branch stats"). Reuses `IReportGenerator` so results stay consistent with `GenerateClosingReport`'s own `byBranch`. */
export class GetBranchPerformance {
  constructor(private readonly reportGenerator: IReportGenerator) {}

  async execute(
    input: GetBranchPerformanceInput,
  ): Promise<Result<ReadonlyArray<BranchPerformance>, ClosingTrackerError>> {
    const result = await this.reportGenerator.generate(input.period);
    if (!result.ok) {
      return err(result.error);
    }
    return ok(result.value.byBranch);
  }
}

import { err, ok, type Result } from "@aos/common";

import type { IReportGenerator } from "../../contracts/IReportGenerator.js";
import type { UnitPerformance } from "../../domain/entities/UnitPerformance.js";
import type { ClosingTrackerError } from "../../domain/errors/ClosingTrackerError.js";
import type { ReportPeriod } from "../../domain/value-objects/ReportPeriod.js";

export interface GetUnitPerformanceInput {
  readonly period: ReportPeriod;
}

/** Per-unit-model closing stats (spec: "GetUnitPerformance ← per-unit-model stats"). Reuses `IReportGenerator` so results stay consistent with `GenerateClosingReport`'s own `byUnit`. */
export class GetUnitPerformance {
  constructor(private readonly reportGenerator: IReportGenerator) {}

  async execute(
    input: GetUnitPerformanceInput,
  ): Promise<Result<ReadonlyArray<UnitPerformance>, ClosingTrackerError>> {
    const result = await this.reportGenerator.generate(input.period);
    if (!result.ok) {
      return err(result.error);
    }
    return ok(result.value.byUnit);
  }
}

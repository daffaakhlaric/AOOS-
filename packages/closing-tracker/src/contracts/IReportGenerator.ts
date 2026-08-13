import type { Result } from "@aos/common";

import type { ClosingReport } from "../domain/entities/ClosingReport.js";
import type { ClosingTrackerError } from "../domain/errors/ClosingTrackerError.js";
import type { ReportPeriod } from "../domain/value-objects/ReportPeriod.js";

/** Contract for `ReportGeneratorService` — composes a full `ClosingReport` for a period. */
export interface IReportGenerator {
  generate(period: ReportPeriod): Promise<Result<ClosingReport, ClosingTrackerError>>;
}

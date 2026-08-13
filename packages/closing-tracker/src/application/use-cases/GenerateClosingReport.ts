import { err, ok, type Result } from "@aos/common";

import type { IReportGenerator } from "../../contracts/IReportGenerator.js";
import type { ClosingReport } from "../../domain/entities/ClosingReport.js";
import type { ClosingTrackerError } from "../../domain/errors/ClosingTrackerError.js";
import type { ClosingTrackerEvents } from "../../domain/events/ClosingTrackerEvents.js";
import type { ReportPeriod } from "../../domain/value-objects/ReportPeriod.js";

export interface GenerateClosingReportInput {
  readonly period: ReportPeriod;
  readonly tenantId: string;
  readonly correlationId: string;
}

/** SPK count milestones that emit `MilestoneReached` when crossed within the period — a judgment call (unspecced beyond the spec's own example, "10 SPK bulan ini"), matching that exact figure plus reasonable round multiples. */
const DEFAULT_MILESTONE_THRESHOLDS: readonly number[] = [10, 25, 50, 100];

/**
 * Main use case: period → full report (spec: "GenerateClosingReport ← main: period → full
 * report"). Emits `ClosingReportGenerated`, plus `MilestoneReached` for every configured SPK
 * milestone the report's `totalSpk` reaches or exceeds.
 */
export class GenerateClosingReport {
  constructor(
    private readonly reportGenerator: IReportGenerator,
    private readonly events: ClosingTrackerEvents,
    private readonly now: () => Date = () => new Date(),
    private readonly milestoneThresholds: readonly number[] = DEFAULT_MILESTONE_THRESHOLDS,
  ) {}

  async execute(
    input: GenerateClosingReportInput,
  ): Promise<Result<ClosingReport, ClosingTrackerError>> {
    const result = await this.reportGenerator.generate(input.period);
    if (!result.ok) {
      return err(result.error);
    }
    const report = result.value;
    const occurredAt = this.now();

    await this.events.publishClosingReportGenerated({
      reportId: report.id,
      periodLabel: input.period.toLabel(),
      totalSpk: report.totalSpk,
      totalTestDrives: report.totalTestDrives,
      closingRate: report.closingRate.value,
      totalCommissionIdr: report.totalCommissionIdr.value,
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      occurredAt,
      version: "1.0",
    });

    for (const threshold of this.milestoneThresholds) {
      if (report.totalSpk >= threshold) {
        await this.events.publishMilestoneReached({
          milestoneType: `${threshold}_SPK`,
          thresholdValue: threshold,
          actualValue: report.totalSpk,
          periodLabel: input.period.toLabel(),
          tenantId: input.tenantId,
          correlationId: input.correlationId,
          occurredAt,
          version: "1.0",
        });
      }
    }

    return ok(report);
  }
}

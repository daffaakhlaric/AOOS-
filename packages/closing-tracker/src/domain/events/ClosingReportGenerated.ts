/** Payload for `aaos.closing-tracker.report.generated`, emitted whenever `GenerateClosingReport` produces a new report. */
export interface ClosingReportGenerated {
  readonly reportId: string;
  readonly periodLabel: string;
  readonly totalSpk: number;
  readonly totalTestDrives: number;
  readonly closingRate: number;
  readonly totalCommissionIdr: number;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}

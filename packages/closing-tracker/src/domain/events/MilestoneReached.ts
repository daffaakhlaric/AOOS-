/** Payload for `aaos.closing-tracker.milestone.reached`, e.g. "10 SPK bulan ini" — emitted by `GenerateClosingReport` whenever `totalSpk` crosses a configured milestone threshold within the period. */
export interface MilestoneReached {
  readonly milestoneType: string; // e.g. "10_SPK"
  readonly thresholdValue: number;
  readonly actualValue: number;
  readonly periodLabel: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}

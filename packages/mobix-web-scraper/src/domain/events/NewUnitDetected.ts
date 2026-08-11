/** Payload for `aaos.mobix-scraper.unit.new-detected`, emitted by `DetectInventoryChanges` for each unit present in the current session but absent from the previous one. */
export interface NewUnitDetected {
  readonly identityKey: string;
  readonly model: string;
  readonly year: number;
  readonly branch: string;
  readonly priceIDR: number;
  readonly occurredAt: Date;
  readonly version: "1.0";
}

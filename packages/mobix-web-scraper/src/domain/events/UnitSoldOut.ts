/** Payload for `aaos.mobix-scraper.unit.sold-out`, emitted by `DetectInventoryChanges` for each unit present in the previous session but absent from the current one. */
export interface UnitSoldOut {
  readonly identityKey: string;
  readonly model: string;
  readonly branch: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}

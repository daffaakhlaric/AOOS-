/** Payload for `aaos.inventory.unit.updated`, emitted when a previously-seen unit's resolved data changes (excluding a transition into `SOLD`, which emits `UnitSold` instead). */
export interface UnitUpdated {
  readonly unitId: string;
  readonly changedFields: ReadonlyArray<string>;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}

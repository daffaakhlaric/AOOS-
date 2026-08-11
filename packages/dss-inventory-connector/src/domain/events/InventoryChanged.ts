/** Payload for `aaos.inventory.changed` — a per-sync summary emitted alongside the more granular per-unit events. */
export interface InventoryChanged {
  readonly sessionId: string;
  readonly added: number;
  readonly updated: number;
  readonly sold: number;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}

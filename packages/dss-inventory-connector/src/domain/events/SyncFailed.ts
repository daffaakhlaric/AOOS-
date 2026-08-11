import type { SourceSystem } from "../value-objects/SourceSystem.js";

/** Payload for `aaos.inventory.sync.failed`, emitted when every attempted adapter fails or no adapter is configured for the requested `SyncMode`. */
export interface SyncFailed {
  readonly sessionId: string;
  readonly sources: ReadonlyArray<SourceSystem>;
  readonly errors: ReadonlyArray<string>;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}

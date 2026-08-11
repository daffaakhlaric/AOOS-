import type { SyncSessionStatus } from "../entities/SyncSession.js";
import type { SourceSystem } from "../value-objects/SourceSystem.js";

/** Payload for `aaos.inventory.sync.completed`, emitted after a sync run finishes as `COMPLETED` or `PARTIAL`. */
export interface SyncCompleted {
  readonly sessionId: string;
  readonly sources: ReadonlyArray<SourceSystem>;
  readonly status: SyncSessionStatus;
  readonly unitsAdded: number;
  readonly unitsUpdated: number;
  readonly unitsSold: number;
  readonly errors: ReadonlyArray<string>;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}

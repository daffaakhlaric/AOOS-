import type { BaseEventShape } from "../contracts/base-event.js";

/**
 * Event Store port — Event Sourcing readiness (docs/PROMPT-005.4-ENTERPRISE-EVENT-BUS.md
 * addendum 1). "Belum ada implementasi database — hanya kontrak (interface)." No class
 * implements this in this package; a future durable-storage package (e.g. backed by
 * Postgres/EventStoreDB) implements it so AI Agent activity can be replayed, audited, and
 * used to re-train/re-evaluate agent strategy from history.
 */
export interface IEventStore {
  append(event: BaseEventShape): Promise<void>;
  getById(eventId: string): Promise<BaseEventShape | undefined>;
  getByCorrelationId(correlationId: string): Promise<readonly BaseEventShape[]>;
  /** Ordered by append order — supports paging via `afterEventId` for large streams. */
  getByType(
    type: string,
    options?: { readonly afterEventId?: string; readonly limit?: number },
  ): Promise<readonly BaseEventShape[]>;
}

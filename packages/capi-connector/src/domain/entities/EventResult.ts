import type { EventName } from "../value-objects/EventName.js";

/** Per-event outcome of a `CapiEvent` send attempt — one produced per event in a flushed `CapiBatch`. Pure data (no invariants to enforce beyond its own type shape), so it stays a plain interface rather than a validated entity class, and is excluded from coverage thresholds like the sibling domain event payload interfaces. */
export interface EventResult {
  readonly eventName: EventName;
  readonly success: boolean;
  readonly fbtraceId?: string;
  readonly errorMessage?: string;
  /** `true` when the event was only buffered (`batchSize > 1`, threshold not yet reached), not actually sent to Meta yet — `success`/`fbtraceId` do not apply in that case. */
  readonly pending?: boolean;
}

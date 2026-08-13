import type { EventName } from "../value-objects/EventName.js";

/** Payload for `aaos.capi-connector.event.failed`, published when a `CapiEvent` send ultimately fails (after exhausting retries, or on a non-retryable error). */
export interface EventFailed {
  readonly eventName: EventName;
  readonly errorMessage: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}

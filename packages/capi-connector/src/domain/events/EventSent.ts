import type { EventName } from "../value-objects/EventName.js";

/** Payload for `aaos.capi-connector.event.sent`, published after one `CapiEvent` is confirmed accepted by Meta CAPI. */
export interface EventSent {
  readonly eventName: EventName;
  readonly fbtraceId?: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}

import type { BaseEventShape } from "../contracts/base-event.js";
import type { TraceContext } from "../tracing/trace-context.js";

export interface SubscriberDeliveryResult {
  readonly subscriberId: string;
  readonly delivered: boolean;
  readonly attempts: number;
  readonly error?: string;
}

export interface DispatchSummary {
  readonly eventId: string;
  readonly matchedSubscribers: number;
  readonly delivered: number;
  readonly dropped: number;
  readonly results: readonly SubscriberDeliveryResult[];
}

export interface IDispatcher {
  dispatch(event: BaseEventShape, traceContext?: TraceContext): Promise<DispatchSummary>;
}

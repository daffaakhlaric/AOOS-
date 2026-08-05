import type { BaseEventShape } from "../contracts/base-event.js";
import type { IRetryPolicy } from "../contracts/retry-policy.js";
import type { IEventFilter } from "../filter/i-filter.js";
import type { RouteCriteria } from "../router/i-router.js";

export type SubscriberHandler = (event: BaseEventShape) => void | Promise<void>;

export interface SubscribeInput {
  /** Namespace/Topic/Pattern/Tenant/Category/Priority — see router/i-router.ts. An empty object subscribes to every event. */
  readonly criteria: RouteCriteria;
  readonly handler: SubscriberHandler;
  /** Defaults to the Subscription Manager's default policy when omitted. */
  readonly retryPolicy?: IRetryPolicy;
  readonly filters?: readonly IEventFilter[];
}

export interface Subscription {
  readonly subscriberId: string;
  readonly criteria: RouteCriteria;
  readonly handler: SubscriberHandler;
  readonly retryPolicy: IRetryPolicy;
  readonly filters: readonly IEventFilter[];
}

/** Subscribe / Unsubscribe / Wildcard / Namespace / Priority Subscription (docs/PROMPT-005.4-ENTERPRISE-EVENT-BUS.md — "Subscriber"). */
export interface ISubscriptionManager {
  subscribe(input: SubscribeInput): string;
  unsubscribe(subscriberId: string): void;
  match(event: BaseEventShape): readonly Subscription[];
  readonly count: number;
}

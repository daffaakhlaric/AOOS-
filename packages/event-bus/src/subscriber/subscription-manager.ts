import type { BaseEventShape } from "../contracts/base-event.js";
import { RetryStrategy, type IRetryPolicy } from "../contracts/retry-policy.js";
import { SubscriptionException } from "../errors/subscription-exception.js";
import { FilterChain } from "../filter/filter-chain.js";
import { EventRouter } from "../router/event-router.js";
import { generateId } from "../utils/id.js";

import type { ISubscriptionManager, SubscribeInput, Subscription } from "./i-subscriber.js";

const NO_RETRY_POLICY: IRetryPolicy = {
  strategy: RetryStrategy.LINEAR,
  maxAttempts: 1,
  nextDelayMs: () => 0,
};

/** In-process Subscription registry — Subscribe/Unsubscribe/Wildcard/Namespace/Priority Subscription. */
export class SubscriptionManager implements ISubscriptionManager {
  private readonly subscriptions = new Map<string, Subscription>();
  private readonly router = new EventRouter();

  constructor(private readonly defaultRetryPolicy: IRetryPolicy = NO_RETRY_POLICY) {}

  subscribe(input: SubscribeInput): string {
    const subscriberId = generateId();
    this.subscriptions.set(subscriberId, {
      subscriberId,
      criteria: input.criteria,
      handler: input.handler,
      retryPolicy: input.retryPolicy ?? this.defaultRetryPolicy,
      filters: input.filters ?? [],
    });
    return subscriberId;
  }

  unsubscribe(subscriberId: string): void {
    if (!this.subscriptions.delete(subscriberId)) {
      throw new SubscriptionException(`Cannot unsubscribe "${subscriberId}": not subscribed`);
    }
  }

  match(event: BaseEventShape): readonly Subscription[] {
    return Array.from(this.subscriptions.values()).filter((subscription) => {
      if (!this.router.matches(event, subscription.criteria)) {
        return false;
      }
      return new FilterChain(subscription.filters).accepts(event);
    });
  }

  get count(): number {
    return this.subscriptions.size;
  }
}

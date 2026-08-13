import type {
  BaseEventShape,
  ISubscriptionManager,
  SubscribeInput,
  Subscription,
} from "@aos/event-bus";
import { vi } from "vitest";

/** A minimal spy-based `ISubscriptionManager` test double — records every `subscribe()`/`unsubscribe()` call, and exposes `dispatch(topic, event)` so unit tests can invoke a registered handler directly without a real `EventBroker`. */
export interface FakeSubscriptionManager extends ISubscriptionManager {
  readonly subscribed: SubscribeInput[];
  readonly unsubscribed: string[];
  dispatch(topic: string, event: BaseEventShape): Promise<void>;
}

export function createFakeSubscriptionManager(): FakeSubscriptionManager {
  const subscribed: SubscribeInput[] = [];
  const unsubscribed: string[] = [];
  const byId = new Map<string, SubscribeInput>();
  let nextId = 0;

  return {
    subscribed,
    unsubscribed,
    subscribe: vi.fn((input: SubscribeInput) => {
      const id = `sub-${nextId}`;
      nextId += 1;
      subscribed.push(input);
      byId.set(id, input);
      return id;
    }),
    unsubscribe: vi.fn((subscriberId: string) => {
      unsubscribed.push(subscriberId);
      byId.delete(subscriberId);
    }),
    match: vi.fn((): readonly Subscription[] => []),
    get count(): number {
      return byId.size;
    },
    async dispatch(topic: string, event: BaseEventShape): Promise<void> {
      const matches = [...byId.values()].filter((input) => input.criteria.topic === topic);
      for (const input of matches) {
        await input.handler(event);
      }
    },
  };
}

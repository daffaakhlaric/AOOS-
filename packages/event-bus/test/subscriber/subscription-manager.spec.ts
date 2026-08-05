import { describe, expect, it, vi } from "vitest";

import type { BaseEventShape } from "../../src/contracts/base-event.js";
import { EventCategory } from "../../src/contracts/event-category.js";
import { EventPriority } from "../../src/contracts/event-priority.js";
import { RetryStrategy } from "../../src/contracts/retry-policy.js";
import { SubscriptionException } from "../../src/errors/subscription-exception.js";
import { SubscriptionManager } from "../../src/subscriber/subscription-manager.js";

function event(overrides: Partial<BaseEventShape> = {}): BaseEventShape {
  return {
    eventId: "550e8400-e29b-41d4-a716-446655440000",
    type: "agent.created",
    category: EventCategory.DOMAIN,
    correlationId: "corr-1",
    source: "agent-runtime",
    producer: "agent-service",
    timestamp: "2026-01-01T00:00:00.000Z",
    priority: EventPriority.NORMAL,
    version: "1.0.0",
    schemaVersion: "1.0.0",
    payload: {},
    ...overrides,
  };
}

describe("Subscriber Test — SubscriptionManager", () => {
  it("Subscribe returns a subscriberId and increments count", () => {
    const manager = new SubscriptionManager();
    const id = manager.subscribe({ criteria: {}, handler: vi.fn() });
    expect(id).toBeTruthy();
    expect(manager.count).toBe(1);
  });

  it("Unsubscribe removes the subscription", () => {
    const manager = new SubscriptionManager();
    const id = manager.subscribe({ criteria: {}, handler: vi.fn() });
    manager.unsubscribe(id);
    expect(manager.count).toBe(0);
  });

  it("Unsubscribe throws SubscriptionException for an unknown id", () => {
    const manager = new SubscriptionManager();
    expect(() => manager.unsubscribe("ghost")).toThrow(SubscriptionException);
  });

  it("Wildcard Subscription (pattern) matches", () => {
    const manager = new SubscriptionManager();
    manager.subscribe({ criteria: { pattern: "agent.**" }, handler: vi.fn() });
    expect(manager.match(event({ type: "agent.created" }))).toHaveLength(1);
    expect(manager.match(event({ type: "tool.invoked" }))).toHaveLength(0);
  });

  it("Namespace Subscription matches", () => {
    const manager = new SubscriptionManager();
    manager.subscribe({ criteria: { namespace: "capability" }, handler: vi.fn() });
    expect(manager.match(event({ type: "capability.resolved" }))).toHaveLength(1);
  });

  it("Priority Subscription matches", () => {
    const manager = new SubscriptionManager();
    manager.subscribe({ criteria: { priority: EventPriority.CRITICAL }, handler: vi.fn() });
    expect(manager.match(event({ priority: EventPriority.CRITICAL }))).toHaveLength(1);
    expect(manager.match(event({ priority: EventPriority.LOW }))).toHaveLength(0);
  });

  it("applies subscription-level filters in addition to routing criteria", () => {
    const manager = new SubscriptionManager();
    manager.subscribe({
      criteria: { namespace: "agent" },
      handler: vi.fn(),
      filters: [{ name: "always-false", accepts: () => false }],
    });
    expect(manager.match(event({ type: "agent.created" }))).toHaveLength(0);
  });

  it("defaults to a single-attempt retry policy when none is supplied", () => {
    const manager = new SubscriptionManager();
    manager.subscribe({ criteria: {}, handler: vi.fn() });
    const [subscription] = manager.match(event());
    expect(subscription?.retryPolicy.maxAttempts).toBe(1);
    expect(subscription?.retryPolicy.strategy).toBe(RetryStrategy.LINEAR);
  });

  it("uses a caller-supplied default retry policy for every subscription", () => {
    const manager = new SubscriptionManager({
      strategy: RetryStrategy.EXPONENTIAL,
      maxAttempts: 5,
      nextDelayMs: () => 100,
    });
    manager.subscribe({ criteria: {}, handler: vi.fn() });
    const [subscription] = manager.match(event());
    expect(subscription?.retryPolicy.maxAttempts).toBe(5);
  });

  it("multiple subscriptions can match the same event", () => {
    const manager = new SubscriptionManager();
    manager.subscribe({ criteria: { namespace: "agent" }, handler: vi.fn() });
    manager.subscribe({ criteria: {}, handler: vi.fn() });
    expect(manager.match(event({ type: "agent.created" }))).toHaveLength(2);
  });
});

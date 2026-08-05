import { describe, expect, it, vi } from "vitest";

import type { BaseEventShape } from "../../src/contracts/base-event.js";
import { EventCategory } from "../../src/contracts/event-category.js";
import { EventPriority } from "../../src/contracts/event-priority.js";
import { RetryStrategy } from "../../src/contracts/retry-policy.js";
import type {
  DeadLetterEntry,
  IDeadLetterQueue,
} from "../../src/dead-letter/i-dead-letter-queue.js";
import { EventDispatcher } from "../../src/dispatcher/event-dispatcher.js";
import { EventBusEventEmitter } from "../../src/events/event-bus-event-emitter.js";
import { EventBusEventName } from "../../src/events/event-bus-event-name.js";
import { EventBusMetricsCollector } from "../../src/metrics/event-bus-metrics-collector.js";
import { SubscriptionManager } from "../../src/subscriber/subscription-manager.js";
import { InMemoryTracer } from "../../src/tracing/in-memory-tracer.js";
import { createTraceContext } from "../../src/tracing/trace-context.js";

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

const noopSleep = async (): Promise<void> => undefined;

class FakeDeadLetterQueue implements IDeadLetterQueue {
  readonly entries: DeadLetterEntry[] = [];
  enqueue(entry: DeadLetterEntry): void {
    this.entries.push(entry);
  }
  list(): readonly DeadLetterEntry[] {
    return this.entries;
  }
}

describe("Event Dispatcher", () => {
  it("delivers to every matching subscriber and reports the summary", async () => {
    const subscriptionManager = new SubscriptionManager();
    const metrics = new EventBusMetricsCollector();
    const handlerA = vi.fn();
    const handlerB = vi.fn();
    subscriptionManager.subscribe({ criteria: { namespace: "agent" }, handler: handlerA });
    subscriptionManager.subscribe({ criteria: {}, handler: handlerB });

    const dispatcher = new EventDispatcher({ subscriptionManager, metrics, sleep: noopSleep });
    const summary = await dispatcher.dispatch(event());

    expect(summary.matchedSubscribers).toBe(2);
    expect(summary.delivered).toBe(2);
    expect(summary.dropped).toBe(0);
    expect(handlerA).toHaveBeenCalledTimes(1);
    expect(handlerB).toHaveBeenCalledTimes(1);
    expect(metrics.snapshot().delivered).toBe(2);
  });

  it("emits EVENT_DELIVERED for each successful delivery", async () => {
    const subscriptionManager = new SubscriptionManager();
    const metrics = new EventBusMetricsCollector();
    const events = new EventBusEventEmitter();
    const listener = vi.fn();
    events.on(EventBusEventName.EVENT_DELIVERED, listener);
    subscriptionManager.subscribe({ criteria: {}, handler: vi.fn() });

    const dispatcher = new EventDispatcher({
      subscriptionManager,
      metrics,
      events,
      sleep: noopSleep,
    });
    await dispatcher.dispatch(event());

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("retries a failing handler under its Retry Policy and eventually succeeds", async () => {
    const subscriptionManager = new SubscriptionManager();
    const metrics = new EventBusMetricsCollector();
    const events = new EventBusEventEmitter();
    const retriedListener = vi.fn();
    events.on(EventBusEventName.EVENT_RETRIED, retriedListener);

    let calls = 0;
    subscriptionManager.subscribe({
      criteria: {},
      handler: () => {
        calls += 1;
        if (calls < 2) {
          throw new Error("transient");
        }
      },
      retryPolicy: { strategy: RetryStrategy.LINEAR, maxAttempts: 3, nextDelayMs: () => 0 },
    });

    const dispatcher = new EventDispatcher({
      subscriptionManager,
      metrics,
      events,
      sleep: noopSleep,
    });
    const summary = await dispatcher.dispatch(event());

    expect(summary.delivered).toBe(1);
    expect(metrics.snapshot().retried).toBe(1);
    expect(retriedListener).toHaveBeenCalledTimes(1);
  });

  it("drops a delivery whose retries are exhausted and records it", async () => {
    const subscriptionManager = new SubscriptionManager();
    const metrics = new EventBusMetricsCollector();
    const events = new EventBusEventEmitter();
    const droppedListener = vi.fn();
    events.on(EventBusEventName.EVENT_DROPPED, droppedListener);

    subscriptionManager.subscribe({
      criteria: {},
      handler: () => {
        throw new Error("always fails");
      },
      retryPolicy: { strategy: RetryStrategy.LINEAR, maxAttempts: 2, nextDelayMs: () => 0 },
    });

    const dispatcher = new EventDispatcher({
      subscriptionManager,
      metrics,
      events,
      sleep: noopSleep,
    });
    const summary = await dispatcher.dispatch(event());

    expect(summary.delivered).toBe(0);
    expect(summary.dropped).toBe(1);
    expect(summary.results[0]?.error).toContain("always fails");
    expect(metrics.snapshot().dropped).toBe(1);
    expect(droppedListener).toHaveBeenCalledTimes(1);
  });

  it("enqueues an exhausted delivery to the Dead Letter Queue when one is configured", async () => {
    const subscriptionManager = new SubscriptionManager();
    const metrics = new EventBusMetricsCollector();
    const events = new EventBusEventEmitter();
    const dlq = new FakeDeadLetterQueue();
    const dlqListener = vi.fn();
    events.on(EventBusEventName.DLQ_ENQUEUED, dlqListener);

    subscriptionManager.subscribe({
      criteria: {},
      handler: () => {
        throw new Error("boom");
      },
      retryPolicy: { strategy: RetryStrategy.LINEAR, maxAttempts: 1, nextDelayMs: () => 0 },
    });

    const dispatcher = new EventDispatcher({
      subscriptionManager,
      metrics,
      events,
      deadLetterQueue: dlq,
      sleep: noopSleep,
    });
    await dispatcher.dispatch(event());

    expect(dlq.entries).toHaveLength(1);
    expect(dlq.entries[0]?.reason).toContain("boom");
    expect(dlqListener).toHaveBeenCalledTimes(1);
  });

  it("does not enqueue to the DLQ when none is configured", async () => {
    const subscriptionManager = new SubscriptionManager();
    const metrics = new EventBusMetricsCollector();
    subscriptionManager.subscribe({
      criteria: {},
      handler: () => {
        throw new Error("boom");
      },
      retryPolicy: { strategy: RetryStrategy.LINEAR, maxAttempts: 1, nextDelayMs: () => 0 },
    });

    const dispatcher = new EventDispatcher({ subscriptionManager, metrics, sleep: noopSleep });
    const summary = await dispatcher.dispatch(event());
    expect(summary.dropped).toBe(1);
  });

  it("records Tracing spans when a trace context is passed", async () => {
    const subscriptionManager = new SubscriptionManager();
    const metrics = new EventBusMetricsCollector();
    const tracer = new InMemoryTracer();
    subscriptionManager.subscribe({ criteria: {}, handler: vi.fn() });

    const dispatcher = new EventDispatcher({
      subscriptionManager,
      metrics,
      tracer,
      sleep: noopSleep,
    });
    await dispatcher.dispatch(event(), createTraceContext("corr-1"));

    const spans = tracer.getSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0]?.context.correlationId).toBe("corr-1");
    expect(spans[0]?.attributes).toMatchObject({ delivered: true });
  });

  it("records a Tracing span on a failed delivery too, when a trace context is passed", async () => {
    const subscriptionManager = new SubscriptionManager();
    const metrics = new EventBusMetricsCollector();
    const tracer = new InMemoryTracer();
    subscriptionManager.subscribe({
      criteria: {},
      handler: () => {
        throw new Error("boom");
      },
      retryPolicy: { strategy: RetryStrategy.LINEAR, maxAttempts: 1, nextDelayMs: () => 0 },
    });

    const dispatcher = new EventDispatcher({
      subscriptionManager,
      metrics,
      tracer,
      sleep: noopSleep,
    });
    await dispatcher.dispatch(event(), createTraceContext("corr-1"));

    const [span] = tracer.getSpans();
    expect(span?.attributes).toMatchObject({
      delivered: false,
      error: expect.stringContaining("boom"),
    });
  });

  it("returns an empty summary when no subscriber matches", async () => {
    const subscriptionManager = new SubscriptionManager();
    const metrics = new EventBusMetricsCollector();
    const dispatcher = new EventDispatcher({ subscriptionManager, metrics, sleep: noopSleep });
    const summary = await dispatcher.dispatch(event());
    expect(summary).toEqual({
      eventId: event().eventId,
      matchedSubscribers: 0,
      delivered: 0,
      dropped: 0,
      results: [],
    });
  });
});

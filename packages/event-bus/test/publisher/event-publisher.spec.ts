import { describe, expect, it, vi } from "vitest";

import { EventCategory } from "../../src/contracts/event-category.js";
import { EventPriority } from "../../src/contracts/event-priority.js";
import type { DispatchSummary, IDispatcher } from "../../src/dispatcher/i-dispatcher.js";
import { ValidationException } from "../../src/errors/validation-exception.js";
import { EventBusEventEmitter } from "../../src/events/event-bus-event-emitter.js";
import { EventBusEventName } from "../../src/events/event-bus-event-name.js";
import { EventBusMetricsCollector } from "../../src/metrics/event-bus-metrics-collector.js";
import { EventPublisher } from "../../src/publisher/event-publisher.js";

function fakeDispatcher(): { dispatcher: IDispatcher; dispatch: ReturnType<typeof vi.fn> } {
  const dispatch = vi.fn(async (): Promise<DispatchSummary> => ({
    eventId: "x",
    matchedSubscribers: 0,
    delivered: 0,
    dropped: 0,
    results: [],
  }));
  return { dispatcher: { dispatch }, dispatch };
}

const basePublishInput = {
  type: "agent.created",
  category: EventCategory.DOMAIN,
  payload: { agentId: "content-manager" },
  source: "agent-runtime",
  producer: "agent-service",
};

describe("Publisher Test — publish()", () => {
  it("fills every generated Event Contract field", async () => {
    const { dispatcher } = fakeDispatcher();
    const publisher = new EventPublisher({ dispatcher, metrics: new EventBusMetricsCollector() });
    const event = await publisher.publish(basePublishInput);

    expect(event.eventId).toBeTruthy();
    expect(event.correlationId).toBeTruthy();
    expect(event.timestamp).toBeTruthy();
    expect(event.version).toBe("1.0.0");
    expect(event.schemaVersion).toBe("1.0.0");
    expect(event.priority).toBe(EventPriority.NORMAL);
  });

  it("awaits full dispatch before resolving", async () => {
    const { dispatcher, dispatch } = fakeDispatcher();
    const publisher = new EventPublisher({ dispatcher, metrics: new EventBusMetricsCollector() });
    await publisher.publish(basePublishInput);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("resolves priority from the namespace when none is supplied", async () => {
    const { dispatcher } = fakeDispatcher();
    const publisher = new EventPublisher({ dispatcher, metrics: new EventBusMetricsCollector() });
    const event = await publisher.publish({ ...basePublishInput, type: "system.degraded" });
    expect(event.priority).toBe(EventPriority.CRITICAL);
  });

  it("uses a caller-supplied priority over the resolver default", async () => {
    const { dispatcher } = fakeDispatcher();
    const publisher = new EventPublisher({ dispatcher, metrics: new EventBusMetricsCollector() });
    const event = await publisher.publish({
      ...basePublishInput,
      type: "system.degraded",
      priority: EventPriority.LOW,
    });
    expect(event.priority).toBe(EventPriority.LOW);
  });

  it("emits EVENT_PUBLISHED and increments the Published metric", async () => {
    const { dispatcher } = fakeDispatcher();
    const events = new EventBusEventEmitter();
    const listener = vi.fn();
    events.on(EventBusEventName.EVENT_PUBLISHED, listener);
    const metrics = new EventBusMetricsCollector();
    const publisher = new EventPublisher({ dispatcher, metrics, events });

    await publisher.publish(basePublishInput);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(metrics.snapshot().published).toBe(1);
  });

  it("rejects an invalid event (Schema Validation) without dispatching", async () => {
    const { dispatcher, dispatch } = fakeDispatcher();
    const events = new EventBusEventEmitter();
    const rejectedListener = vi.fn();
    events.on(EventBusEventName.EVENT_REJECTED, rejectedListener);
    const metrics = new EventBusMetricsCollector();
    const publisher = new EventPublisher({ dispatcher, metrics, events });

    await expect(publisher.publish({ ...basePublishInput, type: "no-namespace" })).rejects.toThrow(
      ValidationException,
    );
    expect(dispatch).not.toHaveBeenCalled();
    expect(rejectedListener).toHaveBeenCalledTimes(1);
    expect(metrics.snapshot().rejected).toBe(1);
  });

  it("enforces Tenant Validation via the configured validationContext", async () => {
    const { dispatcher } = fakeDispatcher();
    const publisher = new EventPublisher({
      dispatcher,
      metrics: new EventBusMetricsCollector(),
      validationContext: { allowedTenantIds: new Set(["t-1"]) },
    });
    await expect(publisher.publish({ ...basePublishInput, tenantId: "t-2" })).rejects.toThrow(
      ValidationException,
    );
  });
});

describe("Publisher Test — publishAsync()", () => {
  it("resolves without waiting for dispatch to complete", async () => {
    const { dispatcher } = fakeDispatcher();
    let dispatchResolved = false;
    (dispatcher.dispatch as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            dispatchResolved = true;
            resolve({ eventId: "x", matchedSubscribers: 0, delivered: 0, dropped: 0, results: [] });
          }, 10);
        }),
    );
    const publisher = new EventPublisher({ dispatcher, metrics: new EventBusMetricsCollector() });
    await publisher.publishAsync(basePublishInput);
    expect(dispatchResolved).toBe(false);
  });

  it("still validates before enqueuing", async () => {
    const { dispatcher } = fakeDispatcher();
    const publisher = new EventPublisher({ dispatcher, metrics: new EventBusMetricsCollector() });
    await expect(
      publisher.publishAsync({ ...basePublishInput, type: "no-namespace" }),
    ).rejects.toThrow(ValidationException);
  });
});

describe("Publisher Test — publishBatch()", () => {
  it("dispatches every event in Priority order", async () => {
    const { dispatcher, dispatch } = fakeDispatcher();
    const publisher = new EventPublisher({ dispatcher, metrics: new EventBusMetricsCollector() });

    const results = await publisher.publishBatch([
      { ...basePublishInput, type: "analytics.sampled", priority: EventPriority.LOW },
      { ...basePublishInput, type: "system.degraded", priority: EventPriority.CRITICAL },
      { ...basePublishInput, type: "agent.created", priority: EventPriority.NORMAL },
    ]);

    expect(results.map((e) => e.priority)).toEqual([
      EventPriority.CRITICAL,
      EventPriority.NORMAL,
      EventPriority.LOW,
    ]);
    expect(dispatch).toHaveBeenCalledTimes(3);
  });

  it("rejects the whole batch atomically when any event is invalid, dispatching nothing", async () => {
    const { dispatcher, dispatch } = fakeDispatcher();
    const metrics = new EventBusMetricsCollector();
    const publisher = new EventPublisher({ dispatcher, metrics });

    await expect(
      publisher.publishBatch([basePublishInput, { ...basePublishInput, type: "bad" }]),
    ).rejects.toThrow(ValidationException);
    expect(dispatch).not.toHaveBeenCalled();
    expect(metrics.snapshot().rejected).toBe(1);
  });

  it("an empty batch resolves to an empty array", async () => {
    const { dispatcher } = fakeDispatcher();
    const publisher = new EventPublisher({ dispatcher, metrics: new EventBusMetricsCollector() });
    expect(await publisher.publishBatch([])).toEqual([]);
  });
});

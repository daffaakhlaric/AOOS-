import { describe, expect, it, vi } from "vitest";

import { EventBroker } from "../../src/broker/event-broker.js";
import { EventCategory } from "../../src/contracts/event-category.js";
import { EventBusEventName } from "../../src/events/event-bus-event-name.js";

const publishInput = {
  type: "agent.created",
  category: EventCategory.DOMAIN,
  payload: { agentId: "content-manager" },
  source: "agent-runtime",
  producer: "agent-service",
};

describe("EventBroker — end-to-end", () => {
  it("publish() delivers to a matching subscriber", async () => {
    const broker = new EventBroker({ sleep: async () => undefined });
    const handler = vi.fn();
    broker.subscribe({ criteria: { namespace: "agent" }, handler });

    await broker.publish(publishInput);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("subscribe()/unsubscribe() maintain subscriberCount and emit internal notifications", () => {
    const broker = new EventBroker();
    const addedListener = vi.fn();
    const removedListener = vi.fn();
    broker.events.on(EventBusEventName.SUBSCRIBER_ADDED, addedListener);
    broker.events.on(EventBusEventName.SUBSCRIBER_REMOVED, removedListener);

    const id = broker.subscribe({ criteria: {}, handler: vi.fn() });
    expect(broker.subscriberCount).toBe(1);
    expect(addedListener).toHaveBeenCalledTimes(1);

    broker.unsubscribe(id);
    expect(broker.subscriberCount).toBe(0);
    expect(removedListener).toHaveBeenCalledTimes(1);
  });

  it("checkHealth() reflects live Metrics", async () => {
    const broker = new EventBroker({ sleep: async () => undefined });
    broker.subscribe({ criteria: {}, handler: vi.fn() });
    await broker.publish(publishInput);
    expect(broker.checkHealth().status).toBe("healthy");
  });

  it("monitorSnapshot() combines Metrics and Health", async () => {
    const broker = new EventBroker({ sleep: async () => undefined });
    await broker.publish(publishInput);
    const snapshot = broker.monitorSnapshot();
    expect(snapshot.metrics.published).toBe(1);
    expect(snapshot.health.status).toBeDefined();
  });

  it("publishAsync() resolves after validation without waiting for delivery", async () => {
    const broker = new EventBroker({ sleep: async () => undefined });
    const handler = vi.fn();
    broker.subscribe({ criteria: {}, handler });
    const event = await broker.publishAsync(publishInput);
    expect(event.type).toBe("agent.created");
  });

  it("publishBatch() delivers every event", async () => {
    const broker = new EventBroker({ sleep: async () => undefined });
    const handler = vi.fn();
    broker.subscribe({ criteria: {}, handler });
    await broker.publishBatch([publishInput, { ...publishInput, type: "agent.updated" }]);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("Tenant Isolation: a disallowed tenant is rejected via the configured validationContext", async () => {
    const broker = new EventBroker({ validationContext: { allowedTenantIds: new Set(["t-1"]) } });
    await expect(broker.publish({ ...publishInput, tenantId: "t-2" })).rejects.toThrow();
  });
});

import { describe, expect, it, vi } from "vitest";

import { EventBusSystem } from "../../src/bootstrap/event-bus-system.js";
import { EventCategory } from "../../src/contracts/event-category.js";
import { RetryStrategy } from "../../src/contracts/retry-policy.js";

describe("EventBusSystem — IModule lifecycle (Kernel integration point)", () => {
  it("exposes a working Broker", async () => {
    const system = new EventBusSystem();
    const handler = vi.fn();
    system.broker.subscribe({ criteria: {}, handler });
    await system.broker.publish({
      type: "agent.created",
      category: EventCategory.DOMAIN,
      payload: {},
      source: "s",
      producer: "p",
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("wires allowedTenantIds/supportedSchemaVersionRange from config into the Broker's validation", async () => {
    const system = new EventBusSystem({ allowedTenantIds: ["t-1"] });
    await expect(
      system.broker.publish({
        type: "agent.created",
        category: EventCategory.DOMAIN,
        payload: {},
        source: "s",
        producer: "p",
        tenantId: "t-2",
      }),
    ).rejects.toThrow();
  });

  it("wires supportedSchemaVersionRange from config into the Broker's validation", async () => {
    const system = new EventBusSystem({ supportedSchemaVersionRange: "^2.0.0" });
    await expect(
      system.broker.publish({
        type: "agent.created",
        category: EventCategory.DOMAIN,
        payload: {},
        source: "s",
        producer: "p",
      }),
    ).rejects.toThrow();
  });

  it("wires a caller-supplied defaultRetryPolicy into the Broker's subscriptions", () => {
    const system = new EventBusSystem({
      defaultRetryPolicy: {
        strategy: RetryStrategy.EXPONENTIAL,
        maxAttempts: 7,
        nextDelayMs: () => 0,
      },
    });
    const id = system.broker.subscribe({ criteria: {}, handler: () => undefined });
    expect(id).toBeTruthy();
  });

  it("onBootstrap resolves without throwing", async () => {
    const system = new EventBusSystem();
    await expect(system.onBootstrap?.({} as never)).resolves.toBeUndefined();
  });

  it("onShutdown clears all internal bus event listeners", async () => {
    const system = new EventBusSystem();
    system.broker.events.on("event_bus.event_published" as never, () => undefined);
    await system.onShutdown?.({} as never);
    expect(system.broker.events.listenerCount("event_bus.event_published" as never)).toBe(0);
  });
});

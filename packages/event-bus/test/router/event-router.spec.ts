import { describe, expect, it } from "vitest";

import type { BaseEventShape } from "../../src/contracts/base-event.js";
import { EventCategory } from "../../src/contracts/event-category.js";
import { EventPriority } from "../../src/contracts/event-priority.js";
import { EventRouter } from "../../src/router/event-router.js";

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

describe("Routing Test — EventRouter", () => {
  const router = new EventRouter();

  it("an empty criteria object matches every event", () => {
    expect(router.matches(event(), {})).toBe(true);
  });

  it("Namespace routing matches the type's dot-prefix", () => {
    expect(router.matches(event({ type: "agent.created" }), { namespace: "agent" })).toBe(true);
    expect(router.matches(event({ type: "tool.invoked" }), { namespace: "agent" })).toBe(false);
  });

  it("Topic routing matches the exact type", () => {
    expect(router.matches(event({ type: "agent.created" }), { topic: "agent.created" })).toBe(true);
    expect(router.matches(event({ type: "agent.updated" }), { topic: "agent.created" })).toBe(
      false,
    );
  });

  it("Pattern routing: `*` matches exactly one segment", () => {
    expect(router.matches(event({ type: "agent.created" }), { pattern: "agent.*" })).toBe(true);
    expect(router.matches(event({ type: "agent.created.retry" }), { pattern: "agent.*" })).toBe(
      false,
    );
  });

  it("Pattern routing: `**` matches any depth", () => {
    expect(router.matches(event({ type: "agent.created" }), { pattern: "agent.**" })).toBe(true);
    expect(router.matches(event({ type: "agent.created.retry" }), { pattern: "agent.**" })).toBe(
      true,
    );
    expect(router.matches(event({ type: "tool.invoked" }), { pattern: "agent.**" })).toBe(false);
  });

  it("Pattern routing: `**` alone matches every type", () => {
    expect(router.matches(event({ type: "capability.resolved" }), { pattern: "**" })).toBe(true);
  });

  it("Tenant routing matches tenantId exactly", () => {
    expect(router.matches(event({ tenantId: "t-1" }), { tenantId: "t-1" })).toBe(true);
    expect(router.matches(event({ tenantId: "t-2" }), { tenantId: "t-1" })).toBe(false);
    expect(router.matches(event({ tenantId: undefined }), { tenantId: "t-1" })).toBe(false);
  });

  it("Category routing matches exactly", () => {
    expect(
      router.matches(event({ category: EventCategory.AUDIT }), { category: EventCategory.AUDIT }),
    ).toBe(true);
    expect(
      router.matches(event({ category: EventCategory.DOMAIN }), { category: EventCategory.AUDIT }),
    ).toBe(false);
  });

  it("Priority routing matches exactly", () => {
    expect(
      router.matches(event({ priority: EventPriority.HIGH }), { priority: EventPriority.HIGH }),
    ).toBe(true);
    expect(
      router.matches(event({ priority: EventPriority.LOW }), { priority: EventPriority.HIGH }),
    ).toBe(false);
  });

  it("combines multiple criteria with AND semantics", () => {
    const e = event({ type: "agent.created", tenantId: "t-1", priority: EventPriority.HIGH });
    expect(
      router.matches(e, { namespace: "agent", tenantId: "t-1", priority: EventPriority.HIGH }),
    ).toBe(true);
    expect(router.matches(e, { namespace: "agent", tenantId: "t-2" })).toBe(false);
  });

  it("caches compiled patterns without changing behavior on repeated use", () => {
    expect(router.matches(event({ type: "agent.created" }), { pattern: "agent.*" })).toBe(true);
    expect(router.matches(event({ type: "tool.invoked" }), { pattern: "agent.*" })).toBe(false);
    expect(router.matches(event({ type: "agent.updated" }), { pattern: "agent.*" })).toBe(true);
  });
});

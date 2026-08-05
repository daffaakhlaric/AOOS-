import { describe, expect, it } from "vitest";

import type { BaseEventShape } from "../../src/contracts/base-event.js";
import { EventCategory } from "../../src/contracts/event-category.js";
import { EventPriority } from "../../src/contracts/event-priority.js";
import { CapabilityFilter } from "../../src/filter/capability-filter.js";
import { FilterChain } from "../../src/filter/filter-chain.js";
import { NamespaceFilter } from "../../src/filter/namespace-filter.js";
import { TenantFilter } from "../../src/filter/tenant-filter.js";
import { TypeFilter } from "../../src/filter/type-filter.js";
import { VersionFilter } from "../../src/filter/version-filter.js";

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

describe("Filtering Test — TenantFilter", () => {
  it("accepts a platform-scoped event", () => {
    expect(new TenantFilter(new Set(["t-1"])).accepts(event())).toBe(true);
  });

  it("accepts an allowed tenant and rejects a disallowed one", () => {
    const filter = new TenantFilter(new Set(["t-1"]));
    expect(filter.accepts(event({ tenantId: "t-1" }))).toBe(true);
    expect(filter.accepts(event({ tenantId: "t-2" }))).toBe(false);
  });
});

describe("Filtering Test — NamespaceFilter", () => {
  it("accepts an allowed namespace and rejects a disallowed one", () => {
    const filter = new NamespaceFilter(new Set(["agent", "tool"]));
    expect(filter.accepts(event({ type: "agent.created" }))).toBe(true);
    expect(filter.accepts(event({ type: "workflow.started" }))).toBe(false);
  });
});

describe("Filtering Test — TypeFilter", () => {
  it("accepts an allowed exact type and rejects any other", () => {
    const filter = new TypeFilter(new Set(["agent.created"]));
    expect(filter.accepts(event({ type: "agent.created" }))).toBe(true);
    expect(filter.accepts(event({ type: "agent.updated" }))).toBe(false);
  });
});

describe("Filtering Test — VersionFilter", () => {
  it("accepts a version within range and rejects one outside it", () => {
    const filter = new VersionFilter("^1.0.0");
    expect(filter.accepts(event({ version: "1.4.0" }))).toBe(true);
    expect(filter.accepts(event({ version: "2.0.0" }))).toBe(false);
  });
});

describe("Filtering Test — CapabilityFilter", () => {
  it("accepts an event with no capabilityId metadata", () => {
    expect(new CapabilityFilter(new Set(["inventory.read"])).accepts(event())).toBe(true);
  });

  it("accepts an allowed capabilityId and rejects a disallowed one", () => {
    const filter = new CapabilityFilter(new Set(["inventory.read"]));
    expect(filter.accepts(event({ metadata: { capabilityId: "inventory.read" } }))).toBe(true);
    expect(filter.accepts(event({ metadata: { capabilityId: "crm.findCustomer" } }))).toBe(false);
  });
});

describe("Filtering Test — FilterChain", () => {
  it("accepts only when every filter accepts (AND semantics)", () => {
    const chain = new FilterChain([
      new NamespaceFilter(new Set(["agent"])),
      new VersionFilter("^1.0.0"),
    ]);
    expect(chain.accepts(event({ type: "agent.created", version: "1.0.0" }))).toBe(true);
    expect(chain.accepts(event({ type: "agent.created", version: "2.0.0" }))).toBe(false);
    expect(chain.accepts(event({ type: "tool.invoked", version: "1.0.0" }))).toBe(false);
  });

  it("an empty chain accepts everything", () => {
    expect(new FilterChain([]).accepts(event())).toBe(true);
  });
});

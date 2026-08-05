import { describe, expect, it } from "vitest";

import { baseEventSchema } from "../../src/contracts/base-event.js";
import { EventCategory } from "../../src/contracts/event-category.js";
import { EventPriority } from "../../src/contracts/event-priority.js";

function validEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    eventId: "550e8400-e29b-41d4-a716-446655440000",
    type: "agent.created",
    category: EventCategory.DOMAIN,
    correlationId: "corr-1",
    source: "agent-runtime",
    producer: "agent-service",
    timestamp: "2026-01-01T00:00:00.000Z",
    version: "1.0.0",
    schemaVersion: "1.0.0",
    payload: { agentId: "content-manager" },
    ...overrides,
  };
}

describe("Schema Test — baseEventSchema", () => {
  it("accepts a minimal valid event", () => {
    expect(baseEventSchema.safeParse(validEvent()).success).toBe(true);
  });

  it("defaults priority to Normal when omitted", () => {
    const result = baseEventSchema.safeParse(validEvent());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe(EventPriority.NORMAL);
    }
  });

  it("accepts every optional field populated", () => {
    const result = baseEventSchema.safeParse(
      validEvent({
        causationId: "cause-1",
        tenantId: "tenant-1",
        priority: EventPriority.HIGH,
        metadata: { capabilityId: "inventory.read" },
        traceId: "trace-1",
      }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects a missing eventId", () => {
    const { eventId: _eventId, ...rest } = validEvent();
    expect(baseEventSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a non-UUID eventId", () => {
    expect(baseEventSchema.safeParse(validEvent({ eventId: "not-a-uuid" })).success).toBe(false);
  });

  it("rejects a type with no namespace dot", () => {
    expect(baseEventSchema.safeParse(validEvent({ type: "created" })).success).toBe(false);
  });

  it("rejects an invalid category", () => {
    expect(baseEventSchema.safeParse(validEvent({ category: "bogus" })).success).toBe(false);
  });

  it("rejects a non-SemVer version", () => {
    expect(baseEventSchema.safeParse(validEvent({ version: "v1" })).success).toBe(false);
  });

  it("rejects a non-SemVer schemaVersion", () => {
    expect(baseEventSchema.safeParse(validEvent({ schemaVersion: "v1" })).success).toBe(false);
  });

  it("rejects a missing source or producer", () => {
    const { source: _source, ...rest } = validEvent();
    expect(baseEventSchema.safeParse(rest).success).toBe(false);
  });
});

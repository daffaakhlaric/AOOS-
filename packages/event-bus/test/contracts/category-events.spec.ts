import { describe, expect, it } from "vitest";

import { auditEventSchema } from "../../src/contracts/audit-event.js";
import { domainEventSchema } from "../../src/contracts/domain-event.js";
import { EventCategory } from "../../src/contracts/event-category.js";
import { infrastructureEventSchema } from "../../src/contracts/infrastructure-event.js";
import { lifecycleEventSchema } from "../../src/contracts/lifecycle-event.js";
import { monitoringEventSchema } from "../../src/contracts/monitoring-event.js";
import { simulationEventSchema } from "../../src/contracts/simulation-event.js";
import { systemEventSchema } from "../../src/contracts/system-event.js";

function base(category: EventCategory, extra: Record<string, unknown> = {}) {
  return {
    eventId: "550e8400-e29b-41d4-a716-446655440000",
    type: "agent.created",
    category,
    correlationId: "corr-1",
    source: "agent-runtime",
    producer: "agent-service",
    timestamp: "2026-01-01T00:00:00.000Z",
    version: "1.0.0",
    schemaVersion: "1.0.0",
    payload: {},
    ...extra,
  };
}

describe("Schema Test — the 7 Event Contract categories", () => {
  it("Domain Event accepts aggregateId/aggregateType and rejects a mismatched category literal", () => {
    expect(
      domainEventSchema.safeParse(
        base(EventCategory.DOMAIN, { aggregateId: "a-1", aggregateType: "Agent" }),
      ).success,
    ).toBe(true);
    expect(domainEventSchema.safeParse(base(EventCategory.SYSTEM)).success).toBe(false);
  });

  it("System Event accepts component and rejects a mismatched category literal", () => {
    expect(
      systemEventSchema.safeParse(base(EventCategory.SYSTEM, { component: "kernel" })).success,
    ).toBe(true);
    expect(systemEventSchema.safeParse(base(EventCategory.DOMAIN)).success).toBe(false);
  });

  it("Infrastructure Event accepts resource and rejects a mismatched category literal", () => {
    expect(
      infrastructureEventSchema.safeParse(
        base(EventCategory.INFRASTRUCTURE, { resource: "registry" }),
      ).success,
    ).toBe(true);
    expect(infrastructureEventSchema.safeParse(base(EventCategory.DOMAIN)).success).toBe(false);
  });

  it("Lifecycle Event accepts a valid phase and rejects an invalid one", () => {
    expect(
      lifecycleEventSchema.safeParse(base(EventCategory.LIFECYCLE, { phase: "started" })).success,
    ).toBe(true);
    expect(
      lifecycleEventSchema.safeParse(base(EventCategory.LIFECYCLE, { phase: "bogus" })).success,
    ).toBe(false);
  });

  it("Audit Event accepts actor/action and rejects a mismatched category literal", () => {
    expect(
      auditEventSchema.safeParse(base(EventCategory.AUDIT, { actor: "user-1", action: "grant" }))
        .success,
    ).toBe(true);
    expect(auditEventSchema.safeParse(base(EventCategory.DOMAIN)).success).toBe(false);
  });

  it("Monitoring Event accepts metricName/metricValue and rejects a mismatched category literal", () => {
    expect(
      monitoringEventSchema.safeParse(
        base(EventCategory.MONITORING, { metricName: "queue_depth", metricValue: 3 }),
      ).success,
    ).toBe(true);
    expect(monitoringEventSchema.safeParse(base(EventCategory.DOMAIN)).success).toBe(false);
  });

  it("Simulation Event accepts scenarioId and rejects a mismatched category literal", () => {
    expect(
      simulationEventSchema.safeParse(base(EventCategory.SIMULATION, { scenarioId: "scn-1" }))
        .success,
    ).toBe(true);
    expect(simulationEventSchema.safeParse(base(EventCategory.DOMAIN)).success).toBe(false);
  });
});

import { EventCategory } from "@aos/event-bus";
import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { DssInventoryConnectorEvents } from "../../../src/domain/events/DssInventoryConnectorEvents.js";
import { SourceSystem } from "../../../src/domain/value-objects/SourceSystem.js";
import { createFakePublisher } from "../../helpers/publisher.js";

describe("DssInventoryConnectorEvents", () => {
  const tenantId = "dss-motor";
  const correlationId = "corr-1";
  const occurredAt = new Date("2026-01-01T00:00:00.000Z");

  it("publishSyncCompleted() publishes aaos.inventory.sync.completed", async () => {
    const publisher = createFakePublisher();
    const events = new DssInventoryConnectorEvents(publisher);
    await events.publishSyncCompleted({
      sessionId: "s1",
      sources: [SourceSystem.MOCK],
      status: "COMPLETED",
      unitsAdded: 1,
      unitsUpdated: 0,
      unitsSold: 0,
      errors: [],
      tenantId,
      correlationId,
      occurredAt,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.inventory.sync.completed");
    expect(publisher.published[0]?.category).toBe(EventCategory.DOMAIN);
    expect(publisher.published[0]?.producer).toBe("@aos/dss-inventory-connector");
  });

  it("publishSyncFailed() publishes aaos.inventory.sync.failed", async () => {
    const publisher = createFakePublisher();
    const events = new DssInventoryConnectorEvents(publisher);
    await events.publishSyncFailed({
      sessionId: "s1",
      sources: [SourceSystem.DMS],
      errors: ["boom"],
      tenantId,
      correlationId,
      occurredAt,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.inventory.sync.failed");
  });

  it("publishUnitAdded() publishes aaos.inventory.unit.added", async () => {
    const publisher = createFakePublisher();
    const events = new DssInventoryConnectorEvents(publisher);
    await events.publishUnitAdded({
      unitId: "u1",
      brand: "Toyota",
      model: "Avanza",
      branch: Branch.BINTARO,
      priceIDR: 100,
      sourceSystem: SourceSystem.MOCK,
      tenantId,
      correlationId,
      occurredAt,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.inventory.unit.added");
  });

  it("publishUnitUpdated() publishes aaos.inventory.unit.updated", async () => {
    const publisher = createFakePublisher();
    const events = new DssInventoryConnectorEvents(publisher);
    await events.publishUnitUpdated({
      unitId: "u1",
      changedFields: ["price"],
      tenantId,
      correlationId,
      occurredAt,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.inventory.unit.updated");
  });

  it("publishUnitSold() publishes aaos.inventory.unit.sold", async () => {
    const publisher = createFakePublisher();
    const events = new DssInventoryConnectorEvents(publisher);
    await events.publishUnitSold({
      unitId: "u1",
      brand: "Toyota",
      model: "Avanza",
      branch: Branch.BANDUNG,
      priceIDR: 100,
      tenantId,
      correlationId,
      occurredAt,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.inventory.unit.sold");
  });

  it("publishUnitReserved() publishes aaos.inventory.unit.reserved", async () => {
    const publisher = createFakePublisher();
    const events = new DssInventoryConnectorEvents(publisher);
    await events.publishUnitReserved({
      unitId: "u1",
      brand: "Toyota",
      model: "Avanza",
      branch: Branch.BANDUNG,
      tenantId,
      correlationId,
      occurredAt,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.inventory.unit.reserved");
  });

  it("publishInventoryChanged() publishes aaos.inventory.changed", async () => {
    const publisher = createFakePublisher();
    const events = new DssInventoryConnectorEvents(publisher);
    await events.publishInventoryChanged({
      sessionId: "s1",
      added: 1,
      updated: 0,
      sold: 0,
      tenantId,
      correlationId,
      occurredAt,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.inventory.changed");
  });

  it("uses a custom source label when provided", async () => {
    const publisher = createFakePublisher();
    const events = new DssInventoryConnectorEvents(publisher, "custom-source");
    await events.publishInventoryChanged({
      sessionId: "s1",
      added: 0,
      updated: 0,
      sold: 0,
      tenantId,
      correlationId,
      occurredAt,
      version: "1.0",
    });
    expect(publisher.published[0]?.source).toBe("custom-source");
  });
});

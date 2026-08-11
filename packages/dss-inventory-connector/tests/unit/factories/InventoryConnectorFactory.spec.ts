import { createMockLogger } from "@aos/testing";
import { describe, expect, it } from "vitest";

import { SourceSystem } from "../../../src/domain/value-objects/SourceSystem.js";
import { InventoryConnectorFactory } from "../../../src/factories/InventoryConnectorFactory.js";
import { CONFIGURED_CONFIG, BASE_CONFIG } from "../../fixtures/inventoryFixtures.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap } from "../../helpers/result.js";
import { createFakeTracer } from "../../helpers/tracer.js";

describe("InventoryConnectorFactory", () => {
  it("registers all 4 adapters into the registry", () => {
    const connector = InventoryConnectorFactory.create({
      config: BASE_CONFIG,
      publisher: createFakePublisher(),
      logger: createMockLogger() as never,
      tracer: createFakeTracer(),
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    });
    expect(connector.registry.get(SourceSystem.MOCK)).toBeDefined();
    expect(connector.registry.get(SourceSystem.GOOGLE_SHEETS)).toBeDefined();
    expect(connector.registry.get(SourceSystem.DMS)).toBeDefined();
    expect(connector.registry.get(SourceSystem.API)).toBeDefined();
  });

  it("wires a fully working syncInventory use case end to end (MOCK mode)", async () => {
    const connector = InventoryConnectorFactory.create({
      config: BASE_CONFIG,
      publisher: createFakePublisher(),
      logger: createMockLogger() as never,
      tracer: createFakeTracer(),
    });
    const session = unwrap(await connector.syncInventory.execute({ correlationId: "corr-1" }));
    expect(session.status).toBe("COMPLETED");
    expect(connector.store.size()).toBe(13);
    expect(connector.getAvailableUnits.execute().length).toBeGreaterThan(0);
  });

  it("uses default logger/tracer/clock when not provided", () => {
    const connector = InventoryConnectorFactory.create({
      config: BASE_CONFIG,
      publisher: createFakePublisher(),
    });
    expect(connector.registry.listAll()).toHaveLength(4);
  });

  it("registers shell adapters configured from CONFIGURED_CONFIG", () => {
    const connector = InventoryConnectorFactory.create({
      config: CONFIGURED_CONFIG,
      publisher: createFakePublisher(),
    });
    expect(connector.registry.get(SourceSystem.GOOGLE_SHEETS)?.isConfigured()).toBe(true);
    expect(connector.registry.get(SourceSystem.DMS)?.isConfigured()).toBe(true);
    expect(connector.registry.get(SourceSystem.API)?.isConfigured()).toBe(true);
  });
});

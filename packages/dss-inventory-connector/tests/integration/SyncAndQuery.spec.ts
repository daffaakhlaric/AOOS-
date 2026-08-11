import { Branch } from "@aos/meta-ads-connector";
import { createMockLogger } from "@aos/testing";
import { describe, expect, it } from "vitest";

import { InventorySnapshot } from "../../src/domain/entities/InventorySnapshot.js";
import { SourcePriority } from "../../src/domain/value-objects/SourcePriority.js";
import { SourceSystem } from "../../src/domain/value-objects/SourceSystem.js";
import { InventoryConnectorFactory } from "../../src/factories/InventoryConnectorFactory.js";
import { BASE_CONFIG } from "../fixtures/inventoryFixtures.js";
import { createFakeAdapter } from "../helpers/fakeAdapter.js";
import { createFakePublisher } from "../helpers/publisher.js";
import { unwrap } from "../helpers/result.js";

describe("Integration: SyncAndQuery", () => {
  it("full cycle: sync → query → detect changes", async () => {
    const connector = InventoryConnectorFactory.create({
      config: BASE_CONFIG,
      publisher: createFakePublisher(),
      logger: createMockLogger() as never,
    });

    const before = unwrap(InventorySnapshot.create("before", new Date(), connector.store.getAll()));
    await connector.syncInventory.execute({ correlationId: "corr-1" });
    const after = unwrap(InventorySnapshot.create("after", new Date(), connector.store.getAll()));

    const changes = connector.detectChanges.execute({ previous: before, current: after });
    expect(changes.added).toHaveLength(13);
  });

  it("Tamara use case: sync → getByModel('Xpander') → campaign can proceed", async () => {
    const connector = InventoryConnectorFactory.create({
      config: BASE_CONFIG,
      publisher: createFakePublisher(),
    });
    await connector.syncInventory.execute({ correlationId: "corr-1" });
    const xpanders = connector.getUnitsByModel.execute("Xpander");
    expect(xpanders.length).toBeGreaterThan(0);
    expect(xpanders.every((unit) => unit.status !== undefined)).toBe(true);
  });

  it("Jessy use case: sync → getByCriteria({ branch: CINERE, maxPrice: 200jt })", async () => {
    const connector = InventoryConnectorFactory.create({
      config: BASE_CONFIG,
      publisher: createFakePublisher(),
    });
    await connector.syncInventory.execute({ correlationId: "corr-1" });
    const matches = connector.queryInventory.execute({
      branch: Branch.CINERE,
      maxPrice: 200_000_000,
    });
    expect(matches.every((unit) => unit.branch === Branch.CINERE)).toBe(true);
    expect(matches.every((unit) => unit.price.toNumber() <= 200_000_000)).toBe(true);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("Stock depletion: mark unit sold → UnitSold event → getAvailable() shrinks", async () => {
    const unit = {
      externalId: "DEPLETE-1",
      brand: "Toyota",
      model: "Rush",
      year: 2021,
      transmission: "AT" as const,
      color: "Hitam",
      kilometer: 25_000,
      priceIDR: 220_000_000,
      branch: "Bintaro",
      status: "AVAILABLE",
    };
    const publisher = createFakePublisher();
    const connector = InventoryConnectorFactory.create({ config: BASE_CONFIG, publisher });
    const adapter = createFakeAdapter({
      sourceSystem: SourceSystem.MOCK,
      priority: SourcePriority.MOCK,
      units: [unit],
    });
    connector.registry.register(adapter);

    await connector.syncInventory.execute({ correlationId: "corr-1" });
    expect(connector.getAvailableUnits.execute()).toHaveLength(1);

    (adapter as unknown as { fetchUnits: () => Promise<unknown> }).fetchUnits = async () => ({
      ok: true,
      value: [{ ...unit, status: "SOLD" }],
    });
    await connector.syncInventory.execute({ correlationId: "corr-2" });

    expect(connector.getAvailableUnits.execute()).toHaveLength(0);
    expect(publisher.published.some((p) => p.type === "aaos.inventory.unit.sold")).toBe(true);
  });
});

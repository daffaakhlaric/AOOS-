import { createMockLogger } from "@aos/testing";
import { describe, expect, it } from "vitest";

import { AdapterError } from "../../src/domain/errors/index.js";
import { SourcePriority } from "../../src/domain/value-objects/SourcePriority.js";
import { SourceSystem } from "../../src/domain/value-objects/SourceSystem.js";
import { UnitStatus } from "../../src/domain/value-objects/UnitStatus.js";
import { InventoryConnectorFactory } from "../../src/factories/InventoryConnectorFactory.js";
import { BASE_CONFIG } from "../fixtures/inventoryFixtures.js";
import { createFakeAdapter } from "../helpers/fakeAdapter.js";
import { createFakePublisher } from "../helpers/publisher.js";

const XPANDER = {
  externalId: "X-1",
  brand: "Mitsubishi",
  model: "Xpander",
  year: 2019,
  transmission: "AT" as const,
  color: "Putih",
  kilometer: 40_000,
  priceIDR: 190_000_000,
  branch: "Bintaro",
  status: "AVAILABLE",
};

describe("Integration: ConflictResolution", () => {
  it("multi-source merge: API + DMS both have Xpander → API wins", async () => {
    const connector = InventoryConnectorFactory.create({
      config: { ...BASE_CONFIG, syncMode: "HYBRID" },
      publisher: createFakePublisher(),
      logger: createMockLogger() as never,
    });
    connector.registry.register(
      createFakeAdapter({
        sourceSystem: SourceSystem.DMS,
        priority: SourcePriority.DMS,
        units: [{ ...XPANDER, priceIDR: 195_000_000, status: "AVAILABLE" }],
      }),
    );
    connector.registry.register(
      createFakeAdapter({
        sourceSystem: SourceSystem.API,
        priority: SourcePriority.API,
        units: [{ ...XPANDER, priceIDR: 195_000_000, status: "SOLD" }],
      }),
    );
    // Mock adapter is also part of HYBRID and always configured — give it no overlapping units.
    connector.registry.register(
      createFakeAdapter({
        sourceSystem: SourceSystem.MOCK,
        priority: SourcePriority.MOCK,
        units: [],
      }),
    );

    await connector.syncInventory.execute({ correlationId: "corr-1" });
    const units = connector.getUnitsByModel.execute("Xpander");
    expect(units).toHaveLength(1);
    expect(units[0]!.status).toBe(UnitStatus.SOLD);
    expect(units[0]!.sourceSystem).toBe(SourceSystem.API);
  });

  it("partial failure: DMS fails → Sheets data used → SyncCompleted PARTIAL", async () => {
    const connector = InventoryConnectorFactory.create({
      config: { ...BASE_CONFIG, syncMode: "HYBRID" },
      publisher: createFakePublisher(),
      logger: createMockLogger() as never,
    });
    connector.registry.register(
      createFakeAdapter({
        sourceSystem: SourceSystem.GOOGLE_SHEETS,
        priority: SourcePriority.SHEETS,
        units: [XPANDER],
      }),
    );
    connector.registry.register(
      createFakeAdapter({
        sourceSystem: SourceSystem.DMS,
        priority: SourcePriority.DMS,
        fetchError: new AdapterError("DMS unavailable", { source: SourceSystem.DMS }),
      }),
    );
    connector.registry.register(
      createFakeAdapter({
        sourceSystem: SourceSystem.MOCK,
        priority: SourcePriority.MOCK,
        units: [],
      }),
    );

    const session = (await connector.syncInventory.execute({ correlationId: "corr-1" })) as {
      ok: true;
      value: { status: string };
    };
    expect(session.ok).toBe(true);
    expect(session.value.status).toBe("PARTIAL");
    const units = connector.getUnitsByModel.execute("Xpander");
    expect(units).toHaveLength(1);
    expect(units[0]!.sourceSystem).toBe(SourceSystem.GOOGLE_SHEETS);
  });
});

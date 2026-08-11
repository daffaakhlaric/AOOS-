import { createMockLogger } from "@aos/testing";
import { describe, expect, it } from "vitest";

import { ConflictResolutionService } from "../../../src/application/services/ConflictResolutionService.js";
import { InventorySyncService } from "../../../src/application/services/InventorySyncService.js";
import { SyncInventory } from "../../../src/application/use-cases/SyncInventory.js";
import { DssInventoryConnectorEvents } from "../../../src/domain/events/DssInventoryConnectorEvents.js";
import { MockInventoryAdapter } from "../../../src/infrastructure/adapters/MockInventoryAdapter.js";
import { InventorySourceRegistry } from "../../../src/infrastructure/registry/InventorySourceRegistry.js";
import { InMemoryInventoryStore } from "../../../src/infrastructure/store/InMemoryInventoryStore.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap } from "../../helpers/result.js";
import { createFakeTracer } from "../../helpers/tracer.js";

describe("SyncInventory", () => {
  it("delegates to InventorySyncService.syncAll() and returns its Result", async () => {
    const registry = new InventorySourceRegistry();
    registry.register(new MockInventoryAdapter());
    const store = new InMemoryInventoryStore();
    const events = new DssInventoryConnectorEvents(createFakePublisher());
    const syncService = new InventorySyncService(
      registry,
      store,
      new ConflictResolutionService(createMockLogger() as never),
      events,
      createMockLogger() as never,
      { syncMode: "MOCK", tenantId: "dss-motor" },
    );
    const useCase = new SyncInventory(syncService, createFakeTracer());
    const session = unwrap(await useCase.execute({ correlationId: "corr-1" }));
    expect(session.status).toBe("COMPLETED");
    expect(store.size()).toBe(13);
  });
});

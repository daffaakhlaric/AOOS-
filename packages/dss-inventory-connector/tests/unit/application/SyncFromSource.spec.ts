import { createMockLogger } from "@aos/testing";
import { describe, expect, it } from "vitest";

import { ConflictResolutionService } from "../../../src/application/services/ConflictResolutionService.js";
import { InventorySyncService } from "../../../src/application/services/InventorySyncService.js";
import { SyncFromSource } from "../../../src/application/use-cases/SyncFromSource.js";
import { DssInventoryConnectorEvents } from "../../../src/domain/events/DssInventoryConnectorEvents.js";
import { SourceSystem } from "../../../src/domain/value-objects/SourceSystem.js";
import { MockInventoryAdapter } from "../../../src/infrastructure/adapters/MockInventoryAdapter.js";
import { InventorySourceRegistry } from "../../../src/infrastructure/registry/InventorySourceRegistry.js";
import { InMemoryInventoryStore } from "../../../src/infrastructure/store/InMemoryInventoryStore.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeTracer } from "../../helpers/tracer.js";

function buildUseCase() {
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
  return { useCase: new SyncFromSource(syncService, createFakeTracer()), store };
}

describe("SyncFromSource", () => {
  it("syncs from exactly the requested source", async () => {
    const { useCase, store } = buildUseCase();
    const session = unwrap(
      await useCase.execute({ source: SourceSystem.MOCK, correlationId: "corr-1" }),
    );
    expect(session.sources).toEqual([SourceSystem.MOCK]);
    expect(store.size()).toBe(13);
  });

  it("returns err for an unregistered source", async () => {
    const { useCase } = buildUseCase();
    const error = unwrapErr(
      await useCase.execute({ source: SourceSystem.DMS, correlationId: "corr-1" }),
    );
    expect(error.message).toContain("No adapter registered");
  });
});

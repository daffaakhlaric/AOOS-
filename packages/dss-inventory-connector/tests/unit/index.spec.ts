import { describe, expect, it } from "vitest";

import * as PublicApi from "../../src/index.js";

describe("public API (index.ts)", () => {
  it("exports the factory", () => {
    expect(PublicApi.InventoryConnectorFactory).toBeDefined();
  });

  it("exports every use case", () => {
    expect(PublicApi.SyncInventory).toBeDefined();
    expect(PublicApi.SyncFromSource).toBeDefined();
    expect(PublicApi.QueryInventory).toBeDefined();
    expect(PublicApi.GetUnit).toBeDefined();
    expect(PublicApi.GetAvailableUnits).toBeDefined();
    expect(PublicApi.GetUnitsByBranch).toBeDefined();
    expect(PublicApi.GetUnitsByModel).toBeDefined();
    expect(PublicApi.GetUnitsByPriceRange).toBeDefined();
    expect(PublicApi.DetectChanges).toBeDefined();
  });

  it("exports every service", () => {
    expect(PublicApi.InventorySyncService).toBeDefined();
    expect(PublicApi.InventoryQueryService).toBeDefined();
    expect(PublicApi.ConflictResolutionService).toBeDefined();
  });

  it("exports domain entities and value objects", () => {
    expect(PublicApi.InventoryUnit).toBeDefined();
    expect(PublicApi.SyncSession).toBeDefined();
    expect(PublicApi.InventorySnapshot).toBeDefined();
    expect(PublicApi.UnitId).toBeDefined();
    expect(PublicApi.SourceSystem).toBeDefined();
    expect(PublicApi.SourcePriority).toBeDefined();
  });

  it("exports every error class", () => {
    expect(PublicApi.InventoryError).toBeDefined();
    expect(PublicApi.SyncError).toBeDefined();
    expect(PublicApi.AdapterError).toBeDefined();
    expect(PublicApi.UnitNotFoundError).toBeDefined();
    expect(PublicApi.ConflictResolutionError).toBeDefined();
  });

  it("exports all 4 adapters and the 13-unit MOCK_UNITS fixture", () => {
    expect(PublicApi.MockInventoryAdapter).toBeDefined();
    expect(PublicApi.GoogleSheetsAdapter).toBeDefined();
    expect(PublicApi.DmsAdapter).toBeDefined();
    expect(PublicApi.InventoryApiAdapter).toBeDefined();
    expect(PublicApi.MOCK_UNITS).toHaveLength(13);
  });

  it("exports the store, registry, builders, and config helpers", () => {
    expect(PublicApi.InMemoryInventoryStore).toBeDefined();
    expect(PublicApi.InventorySourceRegistry).toBeDefined();
    expect(PublicApi.InventoryUnitBuilder).toBeDefined();
    expect(PublicApi.SyncSessionBuilder).toBeDefined();
    expect(PublicApi.parseInventoryConnectorConfig).toBeDefined();
  });

  it("exports the utils", () => {
    expect(PublicApi.classifyModel).toBeDefined();
    expect(PublicApi.estimatedDp).toBeDefined();
    expect(PublicApi.estimatedMonthly).toBeDefined();
    expect(PublicApi.detectBranch).toBeDefined();
  });
});

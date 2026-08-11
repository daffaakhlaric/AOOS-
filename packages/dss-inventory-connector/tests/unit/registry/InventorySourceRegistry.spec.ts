import { describe, expect, it } from "vitest";

import { SourceSystem } from "../../../src/domain/value-objects/SourceSystem.js";
import { MockInventoryAdapter } from "../../../src/infrastructure/adapters/MockInventoryAdapter.js";
import { InventorySourceRegistry } from "../../../src/infrastructure/registry/InventorySourceRegistry.js";

describe("InventorySourceRegistry", () => {
  it("register() then get() returns the same adapter", () => {
    const registry = new InventorySourceRegistry();
    const adapter = new MockInventoryAdapter();
    registry.register(adapter);
    expect(registry.get(SourceSystem.MOCK)).toBe(adapter);
  });

  it("get() returns undefined for an unregistered source", () => {
    const registry = new InventorySourceRegistry();
    expect(registry.get(SourceSystem.DMS)).toBeUndefined();
  });

  it("listAll() returns every registered adapter", () => {
    const registry = new InventorySourceRegistry();
    const adapter = new MockInventoryAdapter();
    registry.register(adapter);
    expect(registry.listAll()).toEqual([adapter]);
  });

  it("register() with the same sourceSystem replaces the previous adapter", () => {
    const registry = new InventorySourceRegistry();
    const first = new MockInventoryAdapter();
    const second = new MockInventoryAdapter();
    registry.register(first);
    registry.register(second);
    expect(registry.get(SourceSystem.MOCK)).toBe(second);
    expect(registry.listAll()).toHaveLength(1);
  });
});

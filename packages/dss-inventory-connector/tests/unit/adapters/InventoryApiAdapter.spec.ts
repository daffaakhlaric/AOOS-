import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { SourcePriority } from "../../../src/domain/value-objects/SourcePriority.js";
import { SourceSystem } from "../../../src/domain/value-objects/SourceSystem.js";
import { InventoryApiAdapter } from "../../../src/infrastructure/adapters/InventoryApiAdapter.js";
import { BASE_CONFIG } from "../../fixtures/inventoryFixtures.js";
import { unwrapErr } from "../../helpers/result.js";

describe("InventoryApiAdapter", () => {
  it("declares sourceSystem API and priority API (3)", () => {
    const adapter = new InventoryApiAdapter(BASE_CONFIG);
    expect(adapter.sourceSystem).toBe(SourceSystem.API);
    expect(adapter.priority).toBe(SourcePriority.API);
  });

  it("isConfigured() is false when no inventoryApiUrl is set", () => {
    expect(new InventoryApiAdapter(BASE_CONFIG).isConfigured()).toBe(false);
  });

  it("isConfigured() is false when only inventoryApiUrl is set (missing inventoryApiKey)", () => {
    const adapter = new InventoryApiAdapter({
      ...BASE_CONFIG,
      inventoryApiUrl: "https://api.example.com",
    });
    expect(adapter.isConfigured()).toBe(false);
  });

  it("isConfigured() is true when both inventoryApiUrl and inventoryApiKey are set", () => {
    const adapter = new InventoryApiAdapter({
      ...BASE_CONFIG,
      inventoryApiUrl: "https://api.example.com",
      inventoryApiKey: "key",
    });
    expect(adapter.isConfigured()).toBe(true);
  });

  it("fetchUnits() returns AdapterError when not configured", async () => {
    const error = unwrapErr(await new InventoryApiAdapter(BASE_CONFIG).fetchUnits());
    expect(error.source).toBe(SourceSystem.API);
    expect(error.message).toContain("not configured");
  });

  it("fetchUnits() returns a 'not yet implemented' AdapterError when configured", async () => {
    const adapter = new InventoryApiAdapter({
      ...BASE_CONFIG,
      inventoryApiUrl: "https://api.example.com",
      inventoryApiKey: "key",
    });
    const error = unwrapErr(await adapter.fetchUnits());
    expect(error.message).toContain("not yet implemented");
  });

  it("fetchUnitsByBranch() delegates to fetchUnits()", async () => {
    const error = unwrapErr(
      await new InventoryApiAdapter(BASE_CONFIG).fetchUnitsByBranch(Branch.BINTARO),
    );
    expect(error.source).toBe(SourceSystem.API);
  });

  it("healthCheck() returns healthy: false when not configured", async () => {
    const result = await new InventoryApiAdapter(BASE_CONFIG).healthCheck();
    expect(result.ok && result.value.healthy).toBe(false);
  });

  it("healthCheck() returns healthy: false with 'Not implemented' when configured", async () => {
    const adapter = new InventoryApiAdapter({
      ...BASE_CONFIG,
      inventoryApiUrl: "https://api.example.com",
      inventoryApiKey: "key",
    });
    const result = await adapter.healthCheck();
    expect(result.ok && result.value.message).toBe("Not implemented");
  });
});

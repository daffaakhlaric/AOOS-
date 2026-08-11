import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { SourcePriority } from "../../../src/domain/value-objects/SourcePriority.js";
import { SourceSystem } from "../../../src/domain/value-objects/SourceSystem.js";
import { DmsAdapter } from "../../../src/infrastructure/adapters/DmsAdapter.js";
import { BASE_CONFIG } from "../../fixtures/inventoryFixtures.js";
import { unwrapErr } from "../../helpers/result.js";

describe("DmsAdapter", () => {
  it("declares sourceSystem DMS and priority DMS (2)", () => {
    const adapter = new DmsAdapter(BASE_CONFIG);
    expect(adapter.sourceSystem).toBe(SourceSystem.DMS);
    expect(adapter.priority).toBe(SourcePriority.DMS);
  });

  it("isConfigured() is false when no dmsApiUrl is set", () => {
    expect(new DmsAdapter(BASE_CONFIG).isConfigured()).toBe(false);
  });

  it("isConfigured() is false when only dmsApiUrl is set (missing dmsApiKey)", () => {
    const adapter = new DmsAdapter({ ...BASE_CONFIG, dmsApiUrl: "https://dms.example.com" });
    expect(adapter.isConfigured()).toBe(false);
  });

  it("isConfigured() is true when both dmsApiUrl and dmsApiKey are set", () => {
    const adapter = new DmsAdapter({
      ...BASE_CONFIG,
      dmsApiUrl: "https://dms.example.com",
      dmsApiKey: "key",
    });
    expect(adapter.isConfigured()).toBe(true);
  });

  it("fetchUnits() returns AdapterError when not configured", async () => {
    const error = unwrapErr(await new DmsAdapter(BASE_CONFIG).fetchUnits());
    expect(error.source).toBe(SourceSystem.DMS);
    expect(error.message).toContain("not configured");
  });

  it("fetchUnits() returns a 'not yet implemented' AdapterError when configured", async () => {
    const adapter = new DmsAdapter({
      ...BASE_CONFIG,
      dmsApiUrl: "https://dms.example.com",
      dmsApiKey: "key",
    });
    const error = unwrapErr(await adapter.fetchUnits());
    expect(error.message).toContain("not yet implemented");
  });

  it("fetchUnitsByBranch() delegates to fetchUnits()", async () => {
    const error = unwrapErr(await new DmsAdapter(BASE_CONFIG).fetchUnitsByBranch(Branch.BINTARO));
    expect(error.source).toBe(SourceSystem.DMS);
  });

  it("healthCheck() returns healthy: false when not configured", async () => {
    const result = await new DmsAdapter(BASE_CONFIG).healthCheck();
    expect(result.ok && result.value.healthy).toBe(false);
  });

  it("healthCheck() returns healthy: false with 'Not implemented' when configured", async () => {
    const adapter = new DmsAdapter({
      ...BASE_CONFIG,
      dmsApiUrl: "https://dms.example.com",
      dmsApiKey: "key",
    });
    const result = await adapter.healthCheck();
    expect(result.ok && result.value.message).toBe("Not implemented");
  });
});

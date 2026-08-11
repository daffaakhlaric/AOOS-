import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { SourcePriority } from "../../../src/domain/value-objects/SourcePriority.js";
import { SourceSystem } from "../../../src/domain/value-objects/SourceSystem.js";
import { GoogleSheetsAdapter } from "../../../src/infrastructure/adapters/GoogleSheetsAdapter.js";
import { BASE_CONFIG } from "../../fixtures/inventoryFixtures.js";
import { unwrapErr } from "../../helpers/result.js";

describe("GoogleSheetsAdapter", () => {
  it("declares sourceSystem GOOGLE_SHEETS and priority SHEETS (1)", () => {
    const adapter = new GoogleSheetsAdapter(BASE_CONFIG);
    expect(adapter.sourceSystem).toBe(SourceSystem.GOOGLE_SHEETS);
    expect(adapter.priority).toBe(SourcePriority.SHEETS);
  });

  it("isConfigured() is false when no credentials are set", () => {
    expect(new GoogleSheetsAdapter(BASE_CONFIG).isConfigured()).toBe(false);
  });

  it("isConfigured() is false when only one of the two required fields is set", () => {
    const adapter = new GoogleSheetsAdapter({
      ...BASE_CONFIG,
      googleSheetsCredentials: "{}",
    });
    expect(adapter.isConfigured()).toBe(false);
  });

  it("isConfigured() is true when both credentials and spreadsheet id are set", () => {
    const adapter = new GoogleSheetsAdapter({
      ...BASE_CONFIG,
      googleSheetsCredentials: "{}",
      googleSheetsSpreadsheetId: "sheet-1",
    });
    expect(adapter.isConfigured()).toBe(true);
  });

  it("fetchUnits() returns AdapterError when not configured", async () => {
    const error = unwrapErr(await new GoogleSheetsAdapter(BASE_CONFIG).fetchUnits());
    expect(error.source).toBe(SourceSystem.GOOGLE_SHEETS);
    expect(error.message).toContain("not configured");
  });

  it("fetchUnits() returns a 'not yet implemented' AdapterError when configured", async () => {
    const adapter = new GoogleSheetsAdapter({
      ...BASE_CONFIG,
      googleSheetsCredentials: "{}",
      googleSheetsSpreadsheetId: "sheet-1",
    });
    const error = unwrapErr(await adapter.fetchUnits());
    expect(error.message).toContain("not yet implemented");
  });

  it("fetchUnitsByBranch() delegates to fetchUnits()", async () => {
    const error = unwrapErr(
      await new GoogleSheetsAdapter(BASE_CONFIG).fetchUnitsByBranch(Branch.BINTARO),
    );
    expect(error.source).toBe(SourceSystem.GOOGLE_SHEETS);
  });

  it("healthCheck() returns healthy: false when not configured", async () => {
    const result = await new GoogleSheetsAdapter(BASE_CONFIG).healthCheck();
    expect(result.ok && result.value.healthy).toBe(false);
    expect(result.ok && result.value.message).toBe("Not configured");
  });

  it("healthCheck() returns healthy: false with 'Not implemented' when configured", async () => {
    const adapter = new GoogleSheetsAdapter({
      ...BASE_CONFIG,
      googleSheetsCredentials: "{}",
      googleSheetsSpreadsheetId: "sheet-1",
    });
    const result = await adapter.healthCheck();
    expect(result.ok && result.value.healthy).toBe(false);
    expect(result.ok && result.value.message).toBe("Not implemented");
  });
});

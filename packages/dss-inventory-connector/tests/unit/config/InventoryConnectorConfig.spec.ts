import { describe, expect, it } from "vitest";

import { parseInventoryConnectorConfig } from "../../../src/config/InventoryConnectorConfig.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("parseInventoryConnectorConfig", () => {
  it("parses a minimal valid config, applying defaults", () => {
    const config = unwrap(parseInventoryConnectorConfig({ tenantId: "dss-motor" }));
    expect(config.tenantId).toBe("dss-motor");
    expect(config.syncMode).toBe("MOCK");
    expect(config.apiSyncIntervalMs).toBe(120_000);
    expect(config.dmsSyncIntervalMs).toBe(1_800_000);
    expect(config.sheetsSyncIntervalMs).toBe(900_000);
  });

  it("parses a fully-specified config", () => {
    const config = unwrap(
      parseInventoryConnectorConfig({
        tenantId: "dss-motor",
        syncMode: "HYBRID",
        apiSyncIntervalMs: 60_000,
        dmsSyncIntervalMs: 600_000,
        sheetsSyncIntervalMs: 300_000,
        googleSheetsCredentials: "{}",
        googleSheetsSpreadsheetId: "sheet-1",
        dmsApiUrl: "https://dms.example.com",
        dmsApiKey: "key",
        inventoryApiUrl: "https://api.example.com",
        inventoryApiKey: "key",
      }),
    );
    expect(config.syncMode).toBe("HYBRID");
    expect(config.googleSheetsSpreadsheetId).toBe("sheet-1");
  });

  it("rejects a missing tenantId", () => {
    const error = unwrapErr(parseInventoryConnectorConfig({}));
    expect(error.message).toContain("validation failed");
  });

  it("rejects an invalid syncMode", () => {
    const error = unwrapErr(
      parseInventoryConnectorConfig({ tenantId: "t1", syncMode: "REALTIME" }),
    );
    expect(error.message).toContain("validation failed");
  });

  it("rejects a non-object input", () => {
    const error = unwrapErr(parseInventoryConnectorConfig(null));
    expect(error.message).toContain("validation failed");
  });
});

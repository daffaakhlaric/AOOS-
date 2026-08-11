import type { InventoryConnectorConfig } from "../../src/config/InventoryConnectorConfig.js";
import type { RawInventoryUnit } from "../../src/contracts/IInventorySourceAdapter.js";
import { SourceSystem } from "../../src/domain/value-objects/SourceSystem.js";
import type { SourceTaggedRawUnit } from "../../src/types/InventoryTypes.js";

export const RAW_XPANDER_BINTARO: RawInventoryUnit = {
  externalId: "RAW-001",
  brand: "Mitsubishi",
  model: "Xpander",
  year: 2019,
  transmission: "AT",
  color: "Putih",
  kilometer: 40_000,
  priceIDR: 190_000_000,
  branch: "Bintaro",
  status: "AVAILABLE",
  photos: [],
  features: [],
};

export function taggedRaw(raw: RawInventoryUnit, sourceSystem: SourceSystem): SourceTaggedRawUnit {
  return { ...raw, sourceSystem };
}

export const SHEETS_XPANDER_BINTARO: SourceTaggedRawUnit = taggedRaw(
  { ...RAW_XPANDER_BINTARO, externalId: "SHEETS-001", priceIDR: 190_000_000, status: "AVAILABLE" },
  SourceSystem.GOOGLE_SHEETS,
);

export const DMS_XPANDER_BINTARO: SourceTaggedRawUnit = taggedRaw(
  { ...RAW_XPANDER_BINTARO, externalId: "DMS-001", priceIDR: 195_000_000, status: "AVAILABLE" },
  SourceSystem.DMS,
);

export const API_XPANDER_BINTARO: SourceTaggedRawUnit = taggedRaw(
  { ...RAW_XPANDER_BINTARO, externalId: "API-001", priceIDR: 195_000_000, status: "SOLD" },
  SourceSystem.API,
);

export const MOCK_XPANDER_BINTARO: SourceTaggedRawUnit = taggedRaw(
  { ...RAW_XPANDER_BINTARO, externalId: "MOCK-001", priceIDR: 185_000_000, status: "AVAILABLE" },
  SourceSystem.MOCK,
);

export const BASE_CONFIG: InventoryConnectorConfig = {
  tenantId: "dss-motor",
  syncMode: "MOCK",
  apiSyncIntervalMs: 120_000,
  dmsSyncIntervalMs: 1_800_000,
  sheetsSyncIntervalMs: 900_000,
};

export const CONFIGURED_CONFIG: InventoryConnectorConfig = {
  ...BASE_CONFIG,
  syncMode: "HYBRID",
  googleSheetsCredentials: "{}",
  googleSheetsSpreadsheetId: "sheet-123",
  dmsApiUrl: "https://dms.example.com",
  dmsApiKey: "dms-key",
  inventoryApiUrl: "https://api.example.com",
  inventoryApiKey: "api-key",
};

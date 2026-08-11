import { err, ok, type Result } from "@aos/common";
import type { Branch } from "@aos/meta-ads-connector";

import type { InventoryConnectorConfig } from "../../config/InventoryConnectorConfig.js";
import type {
  AdapterHealth,
  IInventorySourceAdapter,
  RawInventoryUnit,
} from "../../contracts/IInventorySourceAdapter.js";
import { AdapterError } from "../../domain/errors/index.js";
import { SourcePriority } from "../../domain/value-objects/SourcePriority.js";
import { SourceSystem } from "../../domain/value-objects/SourceSystem.js";

/**
 * Google Sheets Inventory Adapter
 *
 * STATUS: SHELL — not yet implemented
 *
 * Implementation required:
 * - Google Sheets API v4 (sheets.googleapis.com)
 * - Auth: Service Account (JSON key file)
 * - Sheet format: TBD when credentials provided
 *   Expected columns: Model | Tahun | Warna | KM | Harga | Cabang | Status
 *
 * To implement:
 * 1. Set GOOGLE_SHEETS_CREDENTIALS_JSON in .env
 * 2. Set GOOGLE_SHEETS_SPREADSHEET_ID in .env
 * 3. Implement fetchUnits() using the Google Sheets API
 * 4. Map sheet columns to RawInventoryUnit fields (utils/ModelClassifier.ts may help split a
 *    combined "Model" column like "Xpander Cross AT 2019")
 * 5. Remove this comment block
 *
 * See: docs/ADAPTER-IMPLEMENTATION-GUIDE.md
 */
export class GoogleSheetsAdapter implements IInventorySourceAdapter {
  readonly sourceSystem = SourceSystem.GOOGLE_SHEETS;
  readonly priority = SourcePriority.SHEETS;

  constructor(private readonly config: InventoryConnectorConfig) {}

  isConfigured(): boolean {
    return Boolean(this.config.googleSheetsCredentials && this.config.googleSheetsSpreadsheetId);
  }

  async fetchUnits(): Promise<Result<RawInventoryUnit[], AdapterError>> {
    if (!this.isConfigured()) {
      return Promise.resolve(
        err(
          new AdapterError(
            "GoogleSheetsAdapter not configured — missing credentials or spreadsheet ID. " +
              "See docs/ADAPTER-IMPLEMENTATION-GUIDE.md for setup instructions.",
            { source: SourceSystem.GOOGLE_SHEETS },
          ),
        ),
      );
    }
    // TODO: implement Google Sheets API call — blocked on credentials + sheet format from DSS
    // Motor. See docs/ADAPTER-IMPLEMENTATION-GUIDE.md "Implementing GoogleSheetsAdapter".
    return Promise.resolve(
      err(
        new AdapterError("GoogleSheetsAdapter.fetchUnits() not yet implemented", {
          source: SourceSystem.GOOGLE_SHEETS,
        }),
      ),
    );
  }

  async fetchUnitsByBranch(_branch: Branch): Promise<Result<RawInventoryUnit[], AdapterError>> {
    // TODO: filter by branch column in sheet once fetchUnits() is implemented
    return this.fetchUnits();
  }

  async healthCheck(): Promise<Result<AdapterHealth, AdapterError>> {
    if (!this.isConfigured()) {
      return Promise.resolve(ok({ healthy: false, message: "Not configured" }));
    }
    // TODO: ping the Google Sheets API once implemented
    return Promise.resolve(ok({ healthy: false, message: "Not implemented" }));
  }
}

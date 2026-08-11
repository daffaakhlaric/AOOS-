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
 * Custom Inventory API Adapter
 *
 * STATUS: SHELL — not yet implemented
 *
 * Implementation required:
 * - API URL: TBD (pending from DSS Motor)
 * - Auth: TBD
 * - Response format: expected JSON, field mapping TBD
 *
 * This adapter has the highest priority (API > DMS > Sheets) because it provides real-time
 * availability data.
 *
 * To implement:
 * 1. Obtain API URL and auth from DSS Motor
 * 2. Set INVENTORY_API_URL, INVENTORY_API_KEY in .env
 * 3. Implement fetchUnits() using native fetch
 * 4. Map API response to RawInventoryUnit
 * 5. Remove this comment block
 *
 * See: docs/ADAPTER-IMPLEMENTATION-GUIDE.md
 */
export class InventoryApiAdapter implements IInventorySourceAdapter {
  readonly sourceSystem = SourceSystem.API;
  readonly priority = SourcePriority.API;

  constructor(private readonly config: InventoryConnectorConfig) {}

  isConfigured(): boolean {
    return Boolean(this.config.inventoryApiUrl && this.config.inventoryApiKey);
  }

  async fetchUnits(): Promise<Result<RawInventoryUnit[], AdapterError>> {
    if (!this.isConfigured()) {
      return Promise.resolve(
        err(
          new AdapterError(
            "InventoryApiAdapter not configured — missing INVENTORY_API_URL or INVENTORY_API_KEY.",
            { source: SourceSystem.API },
          ),
        ),
      );
    }
    // TODO: implement API call using native fetch — blocked on API docs from DSS Motor. See
    // docs/ADAPTER-IMPLEMENTATION-GUIDE.md "Implementing InventoryApiAdapter".
    return Promise.resolve(
      err(
        new AdapterError(
          "InventoryApiAdapter.fetchUnits() not yet implemented — pending API docs",
          { source: SourceSystem.API },
        ),
      ),
    );
  }

  async fetchUnitsByBranch(_branch: Branch): Promise<Result<RawInventoryUnit[], AdapterError>> {
    // TODO: add ?branch= query param to the API call once fetchUnits() is implemented
    return this.fetchUnits();
  }

  async healthCheck(): Promise<Result<AdapterHealth, AdapterError>> {
    if (!this.isConfigured()) {
      return Promise.resolve(ok({ healthy: false, message: "Not configured" }));
    }
    // TODO: GET /health (or similar) once implemented
    return Promise.resolve(ok({ healthy: false, message: "Not implemented" }));
  }
}

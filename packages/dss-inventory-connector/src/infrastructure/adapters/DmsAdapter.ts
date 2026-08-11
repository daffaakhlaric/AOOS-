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
 * DMS (Dealer Management System) Adapter
 *
 * STATUS: SHELL — not yet implemented
 *
 * Implementation required:
 * - API type: TBD (REST/SOAP — pending documentation from DSS Motor)
 * - Auth: TBD (API key / OAuth / basic auth)
 * - Endpoint: TBD
 *
 * To implement:
 * 1. Obtain DMS API documentation from DSS Motor
 * 2. Set DMS_API_URL, DMS_API_KEY (or other auth) in .env
 * 3. Implement fetchUnits() using the DMS API
 * 4. Map DMS response fields to RawInventoryUnit
 * 5. Remove this comment block
 *
 * See: docs/ADAPTER-IMPLEMENTATION-GUIDE.md
 */
export class DmsAdapter implements IInventorySourceAdapter {
  readonly sourceSystem = SourceSystem.DMS;
  readonly priority = SourcePriority.DMS;

  constructor(private readonly config: InventoryConnectorConfig) {}

  isConfigured(): boolean {
    return Boolean(this.config.dmsApiUrl && this.config.dmsApiKey);
  }

  async fetchUnits(): Promise<Result<RawInventoryUnit[], AdapterError>> {
    if (!this.isConfigured()) {
      return Promise.resolve(
        err(
          new AdapterError(
            "DmsAdapter not configured — missing DMS_API_URL or DMS_API_KEY. " +
              "See docs/ADAPTER-IMPLEMENTATION-GUIDE.md",
            { source: SourceSystem.DMS },
          ),
        ),
      );
    }
    // TODO: implement DMS API call (REST or SOAP — TBD) — blocked on API docs from DSS Motor.
    // See docs/ADAPTER-IMPLEMENTATION-GUIDE.md "Implementing DmsAdapter".
    return Promise.resolve(
      err(
        new AdapterError("DmsAdapter.fetchUnits() not yet implemented — pending API docs", {
          source: SourceSystem.DMS,
        }),
      ),
    );
  }

  async fetchUnitsByBranch(_branch: Branch): Promise<Result<RawInventoryUnit[], AdapterError>> {
    // TODO: add branch filter to DMS query once fetchUnits() is implemented
    return this.fetchUnits();
  }

  async healthCheck(): Promise<Result<AdapterHealth, AdapterError>> {
    if (!this.isConfigured()) {
      return Promise.resolve(ok({ healthy: false, message: "Not configured" }));
    }
    // TODO: ping the DMS health endpoint once implemented
    return Promise.resolve(ok({ healthy: false, message: "Not implemented" }));
  }
}

import type { Branch } from "@aos/meta-ads-connector";

import type { InventoryUnit } from "../../domain/entities/InventoryUnit.js";
import type { InventoryQueryService } from "../services/InventoryQueryService.js";

/** All `AVAILABLE` units, optionally scoped to one `branch`. */
export class GetAvailableUnits {
  constructor(private readonly queryService: InventoryQueryService) {}

  execute(branch?: Branch): ReadonlyArray<InventoryUnit> {
    return branch === undefined
      ? this.queryService.getAvailable()
      : this.queryService.getAvailableByBranch(branch);
  }
}

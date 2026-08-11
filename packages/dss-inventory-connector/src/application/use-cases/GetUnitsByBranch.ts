import type { Branch } from "@aos/meta-ads-connector";

import type { InventoryUnit } from "../../domain/entities/InventoryUnit.js";
import type { InventoryQueryService } from "../services/InventoryQueryService.js";

export class GetUnitsByBranch {
  constructor(private readonly queryService: InventoryQueryService) {}

  execute(branch: Branch): ReadonlyArray<InventoryUnit> {
    return this.queryService.getByBranch(branch);
  }
}

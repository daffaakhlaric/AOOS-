import type { InventoryUnit } from "../../domain/entities/InventoryUnit.js";
import type { InventoryQueryCriteria } from "../../types/InventoryTypes.js";
import type { InventoryQueryService } from "../services/InventoryQueryService.js";

/** Main query entry point — `getByCriteria` covers every field Jessy/Tamara/`@aos/branch-manager` filter on. */
export class QueryInventory {
  constructor(private readonly queryService: InventoryQueryService) {}

  execute(criteria: InventoryQueryCriteria = {}): ReadonlyArray<InventoryUnit> {
    return this.queryService.getByCriteria(criteria);
  }
}

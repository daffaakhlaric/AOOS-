import type { InventoryUnit } from "../../domain/entities/InventoryUnit.js";
import type { InventoryQueryService } from "../services/InventoryQueryService.js";

export class GetUnitsByPriceRange {
  constructor(private readonly queryService: InventoryQueryService) {}

  execute(min: number, max: number): ReadonlyArray<InventoryUnit> {
    return this.queryService.getByPriceRange(min, max);
  }
}

import type { InventoryUnit } from "../../domain/entities/InventoryUnit.js";
import type { InventoryQueryService } from "../services/InventoryQueryService.js";

/** Fuzzy (case-insensitive substring) match on model. */
export class GetUnitsByModel {
  constructor(private readonly queryService: InventoryQueryService) {}

  execute(model: string): ReadonlyArray<InventoryUnit> {
    return this.queryService.getByModel(model);
  }
}

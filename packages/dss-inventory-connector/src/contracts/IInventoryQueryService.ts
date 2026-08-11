import type { Result } from "@aos/common";
import type { Branch } from "@aos/meta-ads-connector";

import type { InventoryUnit } from "../domain/entities/InventoryUnit.js";
import type { UnitNotFoundError } from "../domain/errors/index.js";
import type { UnitId } from "../domain/value-objects/UnitId.js";
import type { UnitPrice } from "../domain/value-objects/UnitPrice.js";
import type { InventoryQueryCriteria } from "../types/InventoryTypes.js";

/** Port for all read/query operations over the store — the only implementation is `application/services/InventoryQueryService.ts`. */
export interface IInventoryQueryService {
  getAll(): ReadonlyArray<InventoryUnit>;
  getById(id: UnitId): Result<InventoryUnit, UnitNotFoundError>;
  getByBranch(branch: Branch): ReadonlyArray<InventoryUnit>;
  getByModel(model: string): ReadonlyArray<InventoryUnit>;
  getByBrand(brand: string): ReadonlyArray<InventoryUnit>;
  getAvailable(): ReadonlyArray<InventoryUnit>;
  getAvailableByBranch(branch: Branch): ReadonlyArray<InventoryUnit>;
  getByPriceRange(min: number, max: number): ReadonlyArray<InventoryUnit>;
  getByCriteria(criteria: InventoryQueryCriteria): ReadonlyArray<InventoryUnit>;
  countByBranch(): Record<Branch, number>;
  countByModel(): Record<string, number>;
  getLowestPriceByModel(model: string): UnitPrice | undefined;
  getTotalInventoryValue(): UnitPrice;
}

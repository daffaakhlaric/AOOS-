import type { Result } from "@aos/common";
import { Branch } from "@aos/meta-ads-connector";

import type { IInventoryQueryService } from "../../contracts/IInventoryQueryService.js";
import type { IInventoryStore } from "../../contracts/IInventoryStore.js";
import type { InventoryUnit } from "../../domain/entities/InventoryUnit.js";
import type { UnitNotFoundError } from "../../domain/errors/index.js";
import type { UnitId } from "../../domain/value-objects/UnitId.js";
import { UnitPrice } from "../../domain/value-objects/UnitPrice.js";
import { UnitStatus } from "../../domain/value-objects/UnitStatus.js";
import type { InventoryQueryCriteria } from "../../types/InventoryTypes.js";

const ALL_BRANCHES: ReadonlyArray<Branch> = Object.values(Branch);

/** All read/query operations over `IInventoryStore` — the query surface Clara, Samantha, and `@aos/branch-manager` consume. */
export class InventoryQueryService implements IInventoryQueryService {
  constructor(private readonly store: IInventoryStore) {}

  getAll(): ReadonlyArray<InventoryUnit> {
    return this.store.getAll();
  }

  getById(id: UnitId): Result<InventoryUnit, UnitNotFoundError> {
    return this.store.getById(id);
  }

  getByBranch(branch: Branch): ReadonlyArray<InventoryUnit> {
    return this.store.getByBranch(branch);
  }

  /** Fuzzy (case-insensitive substring) match on `model`. */
  getByModel(model: string): ReadonlyArray<InventoryUnit> {
    return this.store.getByModel(model);
  }

  /** Fuzzy (case-insensitive substring) match on `brand`. */
  getByBrand(brand: string): ReadonlyArray<InventoryUnit> {
    const needle = brand.trim().toLowerCase();
    return this.store
      .getAll()
      .filter((unit) => unit.brand.toString().toLowerCase().includes(needle));
  }

  getAvailable(): ReadonlyArray<InventoryUnit> {
    return this.store.getAll().filter((unit) => unit.status === UnitStatus.AVAILABLE);
  }

  getAvailableByBranch(branch: Branch): ReadonlyArray<InventoryUnit> {
    return this.store.getByBranch(branch).filter((unit) => unit.status === UnitStatus.AVAILABLE);
  }

  getByPriceRange(min: number, max: number): ReadonlyArray<InventoryUnit> {
    return this.store
      .getAll()
      .filter((unit) => unit.price.toNumber() >= min && unit.price.toNumber() <= max);
  }

  getByCriteria(criteria: InventoryQueryCriteria): ReadonlyArray<InventoryUnit> {
    return this.store.getAll().filter((unit) => {
      if (criteria.branch !== undefined && unit.branch !== criteria.branch) {
        return false;
      }
      if (
        criteria.model !== undefined &&
        !unit.model.toString().toLowerCase().includes(criteria.model.trim().toLowerCase())
      ) {
        return false;
      }
      if (
        criteria.brand !== undefined &&
        !unit.brand.toString().toLowerCase().includes(criteria.brand.trim().toLowerCase())
      ) {
        return false;
      }
      if (criteria.minPrice !== undefined && unit.price.toNumber() < criteria.minPrice) {
        return false;
      }
      if (criteria.maxPrice !== undefined && unit.price.toNumber() > criteria.maxPrice) {
        return false;
      }
      if (
        criteria.maxKilometer !== undefined &&
        unit.kilometer.toNumber() > criteria.maxKilometer
      ) {
        return false;
      }
      if (criteria.transmission !== undefined && unit.transmission !== criteria.transmission) {
        return false;
      }
      if (criteria.status !== undefined && unit.status !== criteria.status) {
        return false;
      }
      return true;
    });
  }

  countByBranch(): Record<Branch, number> {
    const counts = Object.fromEntries(ALL_BRANCHES.map((branch) => [branch, 0])) as Record<
      Branch,
      number
    >;
    for (const unit of this.store.getAll()) {
      counts[unit.branch] += 1;
    }
    return counts;
  }

  countByModel(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const unit of this.store.getAll()) {
      const key = unit.model.toString();
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }

  getLowestPriceByModel(model: string): UnitPrice | undefined {
    const matches = this.getByModel(model);
    if (matches.length === 0) {
      return undefined;
    }
    let lowest = matches[0]!.price;
    for (const unit of matches.slice(1)) {
      if (lowest.isGreaterThan(unit.price)) {
        lowest = unit.price;
      }
    }
    return lowest;
  }

  getTotalInventoryValue(): UnitPrice {
    return this.store.getAll().reduce((total, unit) => total.add(unit.price), UnitPrice.unsafe(0));
  }
}

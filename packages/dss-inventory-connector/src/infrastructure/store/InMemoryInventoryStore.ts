import { err, ok, type Result } from "@aos/common";
import type { Branch } from "@aos/meta-ads-connector";

import type { IInventoryStore } from "../../contracts/IInventoryStore.js";
import type { InventoryUnit } from "../../domain/entities/InventoryUnit.js";
import { UnitNotFoundError } from "../../domain/errors/index.js";
import type { UnitId } from "../../domain/value-objects/UnitId.js";

/**
 * `Map<UnitId, InventoryUnit>` (Repository Pattern) — no database, no filesystem persistence, per
 * the AOS constitution's in-memory-only rule. `getById` is a direct `Map` lookup (never scans);
 * `getByBranch`/`getByModel` necessarily scan the full collection, as any query-by-attribute
 * service does.
 */
export class InMemoryInventoryStore implements IInventoryStore {
  private readonly byId = new Map<string, InventoryUnit>();

  upsert(unit: InventoryUnit): void {
    this.byId.set(unit.id.toString(), unit);
  }

  getById(id: UnitId): Result<InventoryUnit, UnitNotFoundError> {
    const found = this.byId.get(id.toString());
    if (found === undefined) {
      return err(new UnitNotFoundError(`No InventoryUnit found for id "${id.toString()}"`));
    }
    return ok(found);
  }

  getAll(): ReadonlyArray<InventoryUnit> {
    return [...this.byId.values()];
  }

  getByBranch(branch: Branch): ReadonlyArray<InventoryUnit> {
    return this.getAll().filter((unit) => unit.branch === branch);
  }

  getByModel(model: string): ReadonlyArray<InventoryUnit> {
    const needle = model.trim().toLowerCase();
    return this.getAll().filter((unit) => unit.model.toString().toLowerCase().includes(needle));
  }

  remove(id: UnitId): void {
    this.byId.delete(id.toString());
  }

  size(): number {
    return this.byId.size;
  }
}

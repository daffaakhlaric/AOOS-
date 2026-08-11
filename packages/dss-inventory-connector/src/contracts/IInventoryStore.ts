import type { Result } from "@aos/common";
import type { Branch } from "@aos/meta-ads-connector";

import type { InventoryUnit } from "../domain/entities/InventoryUnit.js";
import type { UnitNotFoundError } from "../domain/errors/index.js";
import type { UnitId } from "../domain/value-objects/UnitId.js";

/** Port (Repository Pattern) for the in-memory inventory store. The only implementation is `infrastructure/store/InMemoryInventoryStore.ts`. */
export interface IInventoryStore {
  upsert(unit: InventoryUnit): void;
  getById(id: UnitId): Result<InventoryUnit, UnitNotFoundError>;
  getAll(): ReadonlyArray<InventoryUnit>;
  getByBranch(branch: Branch): ReadonlyArray<InventoryUnit>;
  getByModel(model: string): ReadonlyArray<InventoryUnit>;
  remove(id: UnitId): void;
  size(): number;
}

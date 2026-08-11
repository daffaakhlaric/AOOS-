import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { UnitId } from "../value-objects/UnitId.js";

import type { InventoryUnit } from "./InventoryUnit.js";

/** The full inventory as of one point in time — `DetectChanges`' input, taken before/after a sync. */
export class InventorySnapshot {
  private constructor(
    private readonly snapshotId: string,
    private readonly at: Date,
    private readonly byId: ReadonlyMap<string, InventoryUnit>,
  ) {}

  static create(
    id: string,
    takenAt: Date,
    units: ReadonlyArray<InventoryUnit>,
  ): Result<InventorySnapshot, ValidationError> {
    if (typeof id !== "string" || id.trim().length === 0) {
      return err(new ValidationError("InventorySnapshot.id must be a non-empty string"));
    }
    const byId = new Map<string, InventoryUnit>();
    for (const unit of units) {
      byId.set(unit.id.toString(), unit);
    }
    return ok(new InventorySnapshot(id, takenAt, byId));
  }

  get id(): string {
    return this.snapshotId;
  }

  get takenAt(): Date {
    return this.at;
  }

  get units(): ReadonlyArray<InventoryUnit> {
    return [...this.byId.values()];
  }

  getById(id: UnitId): InventoryUnit | undefined {
    return this.byId.get(id.toString());
  }

  size(): number {
    return this.byId.size;
  }
}

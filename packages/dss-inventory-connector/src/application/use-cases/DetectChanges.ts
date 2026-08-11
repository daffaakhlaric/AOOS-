import type { InventorySnapshot } from "../../domain/entities/InventorySnapshot.js";
import { UnitStatus } from "../../domain/value-objects/UnitStatus.js";
import type { InventoryChangeSet } from "../../types/InventoryTypes.js";

export interface DetectChangesInput {
  readonly previous: InventorySnapshot;
  readonly current: InventorySnapshot;
}

/** Diffs `current` against `previous` — added units, changed units, units newly `SOLD`, and units present in `previous` but no longer in `current`. */
export class DetectChanges {
  execute(input: DetectChangesInput): InventoryChangeSet {
    const added = [];
    const updated = [];
    const sold = [];

    for (const unit of input.current.units) {
      const before = input.previous.getById(unit.id);
      if (before === undefined) {
        added.push(unit);
        continue;
      }
      if (unit.status === UnitStatus.SOLD && before.status !== UnitStatus.SOLD) {
        sold.push(unit);
        continue;
      }
      if (
        before.price.toNumber() !== unit.price.toNumber() ||
        before.status !== unit.status ||
        before.kilometer.toNumber() !== unit.kilometer.toNumber()
      ) {
        updated.push({ previous: before, current: unit });
      }
    }

    const removed = input.previous.units.filter(
      (unit) => input.current.getById(unit.id) === undefined,
    );

    return { added, updated, sold, removed };
  }
}

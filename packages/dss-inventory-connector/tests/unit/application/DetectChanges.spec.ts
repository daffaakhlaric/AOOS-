import { describe, expect, it } from "vitest";

import { DetectChanges } from "../../../src/application/use-cases/DetectChanges.js";
import { InventoryUnitBuilder } from "../../../src/builders/InventoryUnitBuilder.js";
import { InventorySnapshot } from "../../../src/domain/entities/InventorySnapshot.js";
import { InventoryUnit } from "../../../src/domain/entities/InventoryUnit.js";
import { UnitPrice } from "../../../src/domain/value-objects/UnitPrice.js";
import { UnitStatus } from "../../../src/domain/value-objects/UnitStatus.js";
import { unwrap } from "../../helpers/result.js";

function withPrice(unit: InventoryUnit, price: number) {
  return unwrap(
    InventoryUnit.create({
      id: unit.id,
      dmsUnitId: unit.dmsUnitId,
      brand: unit.brand,
      model: unit.model,
      variant: unit.variant,
      year: unit.year,
      transmission: unit.transmission,
      color: unit.color,
      kilometer: unit.kilometer,
      price: unwrap(UnitPrice.create(price)),
      condition: unit.condition,
      status: unit.status,
      branch: unit.branch,
      photos: unit.photos,
      features: unit.features,
      sourceSystem: unit.sourceSystem,
      sourcePriority: unit.sourcePriority,
      syncedAt: unit.syncedAt,
      createdAt: unit.createdAt,
      updatedAt: unit.updatedAt,
    }),
  );
}

function withStatus(unit: InventoryUnit, status: UnitStatus) {
  return unwrap(
    InventoryUnit.create({
      id: unit.id,
      dmsUnitId: unit.dmsUnitId,
      brand: unit.brand,
      model: unit.model,
      variant: unit.variant,
      year: unit.year,
      transmission: unit.transmission,
      color: unit.color,
      kilometer: unit.kilometer,
      price: unit.price,
      condition: unit.condition,
      status,
      branch: unit.branch,
      photos: unit.photos,
      features: unit.features,
      sourceSystem: unit.sourceSystem,
      sourcePriority: unit.sourcePriority,
      syncedAt: unit.syncedAt,
      createdAt: unit.createdAt,
      updatedAt: unit.updatedAt,
    }),
  );
}

describe("DetectChanges", () => {
  it("detects added units", () => {
    const previous = unwrap(InventorySnapshot.create("p", new Date(), []));
    const unit = unwrap(new InventoryUnitBuilder().build());
    const current = unwrap(InventorySnapshot.create("c", new Date(), [unit]));

    const result = new DetectChanges().execute({ previous, current });
    expect(result.added).toEqual([unit]);
    expect(result.updated).toEqual([]);
    expect(result.sold).toEqual([]);
    expect(result.removed).toEqual([]);
  });

  it("detects a unit transitioning to SOLD", () => {
    const original = unwrap(new InventoryUnitBuilder().withStatus(UnitStatus.AVAILABLE).build());
    const previous = unwrap(InventorySnapshot.create("p", new Date(), [original]));
    const sold = withStatus(original, UnitStatus.SOLD);
    const current = unwrap(InventorySnapshot.create("c", new Date(), [sold]));

    const result = new DetectChanges().execute({ previous, current });
    expect(result.sold).toEqual([sold]);
    expect(result.updated).toEqual([]);
  });

  it("detects a price change as an update", () => {
    const original = unwrap(new InventoryUnitBuilder().withPrice(100_000_000).build());
    const previous = unwrap(InventorySnapshot.create("p", new Date(), [original]));
    const updated = withPrice(original, 120_000_000);
    const current = unwrap(InventorySnapshot.create("c", new Date(), [updated]));

    const result = new DetectChanges().execute({ previous, current });
    expect(result.updated).toEqual([{ previous: original, current: updated }]);
  });

  it("detects removed units (present in previous but not current)", () => {
    const unit = unwrap(new InventoryUnitBuilder().build());
    const previous = unwrap(InventorySnapshot.create("p", new Date(), [unit]));
    const current = unwrap(InventorySnapshot.create("c", new Date(), []));

    const result = new DetectChanges().execute({ previous, current });
    expect(result.removed).toEqual([unit]);
  });

  it("reports no changes for two identical snapshots", () => {
    const unit = unwrap(new InventoryUnitBuilder().build());
    const previous = unwrap(InventorySnapshot.create("p", new Date(), [unit]));
    const current = unwrap(InventorySnapshot.create("c", new Date(), [unit]));

    const result = new DetectChanges().execute({ previous, current });
    expect(result).toEqual({ added: [], updated: [], sold: [], removed: [] });
  });
});

import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import {
  InventoryUnit,
  type InventoryUnitProps,
} from "../../../src/domain/entities/InventoryUnit.js";
import { DmsUnitId } from "../../../src/domain/value-objects/DmsUnitId.js";
import { SourcePriority } from "../../../src/domain/value-objects/SourcePriority.js";
import { SourceSystem } from "../../../src/domain/value-objects/SourceSystem.js";
import { SyncTimestamp } from "../../../src/domain/value-objects/SyncTimestamp.js";
import { UnitBrand } from "../../../src/domain/value-objects/UnitBrand.js";
import { UnitCondition } from "../../../src/domain/value-objects/UnitCondition.js";
import { UnitId } from "../../../src/domain/value-objects/UnitId.js";
import { UnitKilometer } from "../../../src/domain/value-objects/UnitKilometer.js";
import { UnitModel } from "../../../src/domain/value-objects/UnitModel.js";
import { UnitPrice } from "../../../src/domain/value-objects/UnitPrice.js";
import { UnitStatus } from "../../../src/domain/value-objects/UnitStatus.js";
import { UnitTransmission } from "../../../src/domain/value-objects/UnitTransmission.js";
import { UnitYear } from "../../../src/domain/value-objects/UnitYear.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function baseProps(overrides: Partial<InventoryUnitProps> = {}): InventoryUnitProps {
  const at = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: UnitId.generate(),
    brand: unwrap(UnitBrand.create("Mitsubishi")),
    model: unwrap(UnitModel.create("Xpander Cross")),
    variant: "",
    year: unwrap(UnitYear.create(2019)),
    transmission: UnitTransmission.AT,
    color: "Putih Pearl",
    kilometer: unwrap(UnitKilometer.create(45_000)),
    price: unwrap(UnitPrice.create(195_000_000)),
    condition: UnitCondition.GOOD,
    status: UnitStatus.AVAILABLE,
    branch: Branch.BINTARO,
    photos: [],
    features: ["Panoramic Roof"],
    sourceSystem: SourceSystem.MOCK,
    sourcePriority: SourcePriority.MOCK,
    syncedAt: unwrap(SyncTimestamp.create(at)),
    createdAt: at,
    updatedAt: at,
    ...overrides,
  };
}

describe("InventoryUnit.create", () => {
  it("builds a valid unit and exposes every getter", () => {
    const unit = unwrap(InventoryUnit.create(baseProps()));
    expect(unit.brand.toString()).toBe("Mitsubishi");
    expect(unit.model.toString()).toBe("Xpander Cross");
    expect(unit.variant).toBe("");
    expect(unit.year.toNumber()).toBe(2019);
    expect(unit.transmission).toBe(UnitTransmission.AT);
    expect(unit.color).toBe("Putih Pearl");
    expect(unit.kilometer.toNumber()).toBe(45_000);
    expect(unit.price.toNumber()).toBe(195_000_000);
    expect(unit.condition).toBe(UnitCondition.GOOD);
    expect(unit.status).toBe(UnitStatus.AVAILABLE);
    expect(unit.branch).toBe(Branch.BINTARO);
    expect(unit.photos).toEqual([]);
    expect(unit.features).toEqual(["Panoramic Roof"]);
    expect(unit.sourceSystem).toBe(SourceSystem.MOCK);
    expect(unit.sourcePriority).toBe(SourcePriority.MOCK);
    expect(unit.dmsUnitId).toBeUndefined();
    expect(unit.createdAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
    expect(unit.updatedAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
    expect(unit.syncedAt.toDate()).toEqual(new Date("2026-01-01T00:00:00.000Z"));
  });

  it("defensively copies photos/features arrays", () => {
    const photos = ["a.jpg"];
    const features = ["Sunroof"];
    const unit = unwrap(InventoryUnit.create(baseProps({ photos, features })));
    photos.push("b.jpg");
    features.push("360 Camera");
    expect(unit.photos).toEqual(["a.jpg"]);
    expect(unit.features).toEqual(["Sunroof"]);
  });

  it("rejects a non-string variant at the type boundary", () => {
    const error = unwrapErr(InventoryUnit.create(baseProps({ variant: 123 as unknown as string })));
    expect(error.message).toContain("variant");
  });

  it("rejects an empty color", () => {
    const error = unwrapErr(InventoryUnit.create(baseProps({ color: "" })));
    expect(error.message).toContain("color");
  });

  it("rejects an invalid transmission at the type boundary", () => {
    const error = unwrapErr(
      InventoryUnit.create(baseProps({ transmission: "CVT" as unknown as UnitTransmission })),
    );
    expect(error.message).toContain("transmission");
  });

  it("rejects an invalid condition at the type boundary", () => {
    const error = unwrapErr(
      InventoryUnit.create(baseProps({ condition: "EXCELLENT" as unknown as UnitCondition })),
    );
    expect(error.message).toContain("condition");
  });

  it("rejects an invalid status at the type boundary", () => {
    const error = unwrapErr(
      InventoryUnit.create(baseProps({ status: "PENDING" as unknown as UnitStatus })),
    );
    expect(error.message).toContain("status");
  });

  it("rejects updatedAt preceding createdAt", () => {
    const at = new Date("2026-01-01T00:00:00.000Z");
    const before = new Date("2025-12-31T00:00:00.000Z");
    const error = unwrapErr(InventoryUnit.create(baseProps({ createdAt: at, updatedAt: before })));
    expect(error.message).toContain("updatedAt");
  });

  it("accepts an optional dmsUnitId", () => {
    const dmsUnitId = unwrap(DmsUnitId.create("DMS-1"));
    const unit = unwrap(InventoryUnit.create(baseProps({ dmsUnitId })));
    expect(unit.dmsUnitId?.toString()).toBe("DMS-1");
  });
});

describe("InventoryUnit computed getters", () => {
  it('displayName is "Mitsubishi Xpander Cross AT 2019" (spec pinned example)', () => {
    const unit = unwrap(InventoryUnit.create(baseProps()));
    expect(unit.displayName).toBe("Mitsubishi Xpander Cross AT 2019");
  });

  it("displayName includes a non-empty variant", () => {
    const unit = unwrap(InventoryUnit.create(baseProps({ variant: "Ultimate" })));
    expect(unit.displayName).toBe("Mitsubishi Xpander Cross Ultimate AT 2019");
  });

  it("estimatedDp is price × 0.15 rounded to nearest juta (spec pinned example: 29_000_000)", () => {
    const unit = unwrap(
      InventoryUnit.create(baseProps({ price: unwrap(UnitPrice.create(195_000_000)) })),
    );
    expect(unit.estimatedDp.toNumber()).toBe(29_000_000);
  });

  it("estimatedMonthly is within the spec's ±100,000 tolerance of 5_447_333", () => {
    const unit = unwrap(
      InventoryUnit.create(baseProps({ price: unwrap(UnitPrice.create(195_000_000)) })),
    );
    expect(Math.abs(unit.estimatedMonthly.toNumber() - 5_447_333)).toBeLessThanOrEqual(100_000);
  });

  it("isAffordableFor(200_000_000) is true for a 195jt unit (spec pinned example)", () => {
    const unit = unwrap(
      InventoryUnit.create(baseProps({ price: unwrap(UnitPrice.create(195_000_000)) })),
    );
    expect(unit.isAffordableFor(200_000_000)).toBe(true);
  });

  it("isAffordableFor() is false when the budget is below price", () => {
    const unit = unwrap(
      InventoryUnit.create(baseProps({ price: unwrap(UnitPrice.create(195_000_000)) })),
    );
    expect(unit.isAffordableFor(100_000_000)).toBe(false);
  });

  it("isAffordableFor() is true when the budget exactly equals price", () => {
    const unit = unwrap(
      InventoryUnit.create(baseProps({ price: unwrap(UnitPrice.create(195_000_000)) })),
    );
    expect(unit.isAffordableFor(195_000_000)).toBe(true);
  });

  it("ageInDays is 0 immediately after createdAt", () => {
    const now = new Date();
    const unit = unwrap(InventoryUnit.create(baseProps({ createdAt: now, updatedAt: now })));
    expect(unit.ageInDays).toBe(0);
  });

  it("ageInDays counts whole days elapsed since createdAt", () => {
    const createdAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 - 1000);
    const unit = unwrap(InventoryUnit.create(baseProps({ createdAt, updatedAt: createdAt })));
    expect(unit.ageInDays).toBe(3);
  });
});

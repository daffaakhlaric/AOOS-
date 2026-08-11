import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { InventoryUnitBuilder } from "../../../src/builders/InventoryUnitBuilder.js";
import { DmsUnitId } from "../../../src/domain/value-objects/DmsUnitId.js";
import { SourceSystem } from "../../../src/domain/value-objects/SourceSystem.js";
import { UnitCondition } from "../../../src/domain/value-objects/UnitCondition.js";
import { UnitStatus } from "../../../src/domain/value-objects/UnitStatus.js";
import { UnitTransmission } from "../../../src/domain/value-objects/UnitTransmission.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("InventoryUnitBuilder", () => {
  it("builds a valid unit with sensible defaults", () => {
    const unit = unwrap(new InventoryUnitBuilder().build());
    expect(unit.brand.toString()).toBe("Mitsubishi");
    expect(unit.status).toBe(UnitStatus.AVAILABLE);
    expect(unit.sourceSystem).toBe(SourceSystem.MOCK);
  });

  it("applies every with*() override", () => {
    const dmsUnitId = unwrap(DmsUnitId.create("DMS-9"));
    const unit = unwrap(
      new InventoryUnitBuilder()
        .withDmsUnitId(dmsUnitId)
        .withBrand("Toyota")
        .withModel("Avanza")
        .withVariant("Veloz")
        .withYear(2021)
        .withTransmission(UnitTransmission.MT)
        .withColor("Hitam")
        .withKilometer(10_000)
        .withPrice(150_000_000)
        .withCondition(UnitCondition.FAIR)
        .withStatus(UnitStatus.RESERVED)
        .withBranch(Branch.CINERE)
        .withPhotos(["p.jpg"])
        .withFeatures(["ABS"])
        .withSourceSystem(SourceSystem.DMS)
        .withSyncedAt(new Date("2026-02-01T00:00:00.000Z"))
        .withCreatedAt(new Date("2026-01-15T00:00:00.000Z"))
        .withUpdatedAt(new Date("2026-01-20T00:00:00.000Z"))
        .build(),
    );
    expect(unit.dmsUnitId?.toString()).toBe("DMS-9");
    expect(unit.brand.toString()).toBe("Toyota");
    expect(unit.model.toString()).toBe("Avanza");
    expect(unit.variant).toBe("Veloz");
    expect(unit.year.toNumber()).toBe(2021);
    expect(unit.transmission).toBe(UnitTransmission.MT);
    expect(unit.color).toBe("Hitam");
    expect(unit.kilometer.toNumber()).toBe(10_000);
    expect(unit.price.toNumber()).toBe(150_000_000);
    expect(unit.condition).toBe(UnitCondition.FAIR);
    expect(unit.status).toBe(UnitStatus.RESERVED);
    expect(unit.branch).toBe(Branch.CINERE);
    expect(unit.photos).toEqual(["p.jpg"]);
    expect(unit.features).toEqual(["ABS"]);
    expect(unit.sourceSystem).toBe(SourceSystem.DMS);
  });

  it("propagates a validation error for an invalid brand", () => {
    const error = unwrapErr(new InventoryUnitBuilder().withBrand("").build());
    expect(error.message).toContain("UnitBrand");
  });

  it("propagates a validation error for an invalid model", () => {
    const error = unwrapErr(new InventoryUnitBuilder().withModel("").build());
    expect(error.message).toContain("UnitModel");
  });

  it("propagates a validation error for an invalid year", () => {
    const error = unwrapErr(new InventoryUnitBuilder().withYear(1899).build());
    expect(error.message).toContain("UnitYear");
  });

  it("propagates a validation error for an invalid kilometer", () => {
    const error = unwrapErr(new InventoryUnitBuilder().withKilometer(-1).build());
    expect(error.message).toContain("UnitKilometer");
  });

  it("propagates a validation error for an invalid price", () => {
    const error = unwrapErr(new InventoryUnitBuilder().withPrice(-1).build());
    expect(error.message).toContain("UnitPrice");
  });

  it("propagates a validation error for an invalid syncedAt", () => {
    const error = unwrapErr(
      new InventoryUnitBuilder().withSyncedAt(new Date("not-a-date")).build(),
    );
    expect(error.message).toContain("SyncTimestamp");
  });

  it("propagates a validation error from InventoryUnit.create itself (e.g. updatedAt before createdAt)", () => {
    const error = unwrapErr(
      new InventoryUnitBuilder()
        .withCreatedAt(new Date("2026-02-01T00:00:00.000Z"))
        .withUpdatedAt(new Date("2026-01-01T00:00:00.000Z"))
        .build(),
    );
    expect(error.message).toContain("updatedAt");
  });
});

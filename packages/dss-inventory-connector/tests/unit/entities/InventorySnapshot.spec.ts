import { describe, expect, it } from "vitest";

import { InventoryUnitBuilder } from "../../../src/builders/InventoryUnitBuilder.js";
import { InventorySnapshot } from "../../../src/domain/entities/InventorySnapshot.js";
import { UnitId } from "../../../src/domain/value-objects/UnitId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("InventorySnapshot.create", () => {
  it("builds a snapshot indexed by unit id", () => {
    const unit = unwrap(new InventoryUnitBuilder().build());
    const at = new Date("2026-01-01T00:00:00.000Z");
    const snapshot = unwrap(InventorySnapshot.create("snap-1", at, [unit]));
    expect(snapshot.id).toBe("snap-1");
    expect(snapshot.takenAt).toEqual(at);
    expect(snapshot.size()).toBe(1);
    expect(snapshot.units).toEqual([unit]);
    expect(snapshot.getById(unit.id)).toBe(unit);
  });

  it("rejects an empty id", () => {
    const error = unwrapErr(InventorySnapshot.create("", new Date(), []));
    expect(error.message).toContain("id");
  });

  it("getById() returns undefined for an unknown id", () => {
    const snapshot = unwrap(InventorySnapshot.create("snap-1", new Date(), []));
    expect(snapshot.getById(UnitId.generate())).toBeUndefined();
  });

  it("handles an empty unit list", () => {
    const snapshot = unwrap(InventorySnapshot.create("snap-1", new Date(), []));
    expect(snapshot.size()).toBe(0);
    expect(snapshot.units).toEqual([]);
  });
});

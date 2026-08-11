import { err, ok } from "@aos/common";
import type { IInventoryQueryService, InventoryUnit } from "@aos/dss-inventory-connector";
import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { InventoryQueryServiceSpy } from "../../../../src/application/services/InventoryQueryServiceSpy.js";

function makeFakeQueryService(
  overrides: Partial<IInventoryQueryService> = {},
): IInventoryQueryService {
  const units: ReadonlyArray<InventoryUnit> = [];
  return {
    getAll: () => units,
    getById: () => err(new Error("not found") as never),
    getByBranch: () => units,
    getByModel: () => units,
    getByBrand: () => units,
    getAvailable: () => units,
    getAvailableByBranch: () => units,
    getByPriceRange: () => units,
    getByCriteria: () => units,
    countByBranch: () => ({}) as Record<Branch, number>,
    countByModel: () => ({}),
    getLowestPriceByModel: () => undefined,
    getTotalInventoryValue: () => ({ toRupiah: () => 0 }) as never,
    ...overrides,
  };
}

describe("InventoryQueryServiceSpy", () => {
  it("wasUsedWithResult starts false", () => {
    const spy = new InventoryQueryServiceSpy(makeFakeQueryService());
    expect(spy.wasUsedWithResult).toBe(false);
  });

  it("getAvailableByBranch() with a non-empty result flips wasUsedWithResult to true", () => {
    const unit = { id: "u1" } as unknown as InventoryUnit;
    const spy = new InventoryQueryServiceSpy(
      makeFakeQueryService({ getAvailableByBranch: () => [unit] }),
    );
    spy.getAvailableByBranch(Branch.CINERE);
    expect(spy.wasUsedWithResult).toBe(true);
  });

  it("getAvailableByBranch() with an empty result leaves wasUsedWithResult false", () => {
    const spy = new InventoryQueryServiceSpy(
      makeFakeQueryService({ getAvailableByBranch: () => [] }),
    );
    spy.getAvailableByBranch(Branch.CINERE);
    expect(spy.wasUsedWithResult).toBe(false);
  });

  it("getAvailable() with a non-empty result flips wasUsedWithResult to true", () => {
    const unit = { id: "u1" } as unknown as InventoryUnit;
    const spy = new InventoryQueryServiceSpy(makeFakeQueryService({ getAvailable: () => [unit] }));
    spy.getAvailable();
    expect(spy.wasUsedWithResult).toBe(true);
  });

  it("wasUsedWithResult stays true once flipped, even if a later call returns empty", () => {
    const unit = { id: "u1" } as unknown as InventoryUnit;
    let callCount = 0;
    const spy = new InventoryQueryServiceSpy(
      makeFakeQueryService({
        getAvailableByBranch: () => {
          callCount += 1;
          return callCount === 1 ? [unit] : [];
        },
      }),
    );
    spy.getAvailableByBranch(Branch.CINERE);
    spy.getAvailableByBranch(Branch.CINERE);
    expect(spy.wasUsedWithResult).toBe(true);
  });

  it("delegates every other method to the real service unchanged", () => {
    const unit = { id: "u1" } as unknown as InventoryUnit;
    const real = makeFakeQueryService({
      getAll: () => [unit],
      getByBranch: () => [unit],
      getByModel: () => [unit],
      getByBrand: () => [unit],
      getByPriceRange: () => [unit],
      getByCriteria: () => [unit],
      getById: () => ok(unit),
      getLowestPriceByModel: () => ({ toRupiah: () => 100 }) as never,
    });
    const spy = new InventoryQueryServiceSpy(real);

    expect(spy.getAll()).toEqual([unit]);
    expect(spy.getByBranch(Branch.CINERE)).toEqual([unit]);
    expect(spy.getByModel("Xpander")).toEqual([unit]);
    expect(spy.getByBrand("Mitsubishi")).toEqual([unit]);
    expect(spy.getByPriceRange(0, 100)).toEqual([unit]);
    expect(spy.getByCriteria({})).toEqual([unit]);
    expect(spy.getById("u1" as never)).toEqual(ok(unit));
    expect(spy.countByBranch()).toEqual({});
    expect(spy.countByModel()).toEqual({});
    expect(spy.getLowestPriceByModel("Xpander")).toBeDefined();
    expect(spy.getTotalInventoryValue()).toBeDefined();
    // getAvailable()/getAvailableByBranch() with the default empty-array fake don't flip the flag.
    expect(spy.wasUsedWithResult).toBe(false);
  });
});

import { Branch } from "@aos/meta-ads-connector";
import { beforeEach, describe, expect, it } from "vitest";

import { InventoryQueryService } from "../../../src/application/services/InventoryQueryService.js";
import { InventoryUnitBuilder } from "../../../src/builders/InventoryUnitBuilder.js";
import { UnitId } from "../../../src/domain/value-objects/UnitId.js";
import { UnitStatus } from "../../../src/domain/value-objects/UnitStatus.js";
import { UnitTransmission } from "../../../src/domain/value-objects/UnitTransmission.js";
import { InMemoryInventoryStore } from "../../../src/infrastructure/store/InMemoryInventoryStore.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("InventoryQueryService", () => {
  let store: InMemoryInventoryStore;
  let query: InventoryQueryService;

  beforeEach(() => {
    store = new InMemoryInventoryStore();
    query = new InventoryQueryService(store);

    const bintaroAvailable = [
      { model: "Xpander Cross", price: 195_000_000 },
      { model: "Xpander Exceed", price: 210_000_000 },
      { model: "Brio RS", price: 158_000_000, brand: "Honda" },
    ];
    for (const spec of bintaroAvailable) {
      store.upsert(
        unwrap(
          new InventoryUnitBuilder()
            .withBranch(Branch.BINTARO)
            .withModel(spec.model)
            .withBrand(spec.brand ?? "Mitsubishi")
            .withPrice(spec.price)
            .withStatus(UnitStatus.AVAILABLE)
            .build(),
        ),
      );
    }
    store.upsert(
      unwrap(
        new InventoryUnitBuilder()
          .withBranch(Branch.BINTARO)
          .withModel("Avanza Veloz")
          .withBrand("Toyota")
          .withPrice(148_000_000)
          .withStatus(UnitStatus.RESERVED)
          .build(),
      ),
    );
    for (let i = 0; i < 5; i += 1) {
      store.upsert(
        unwrap(
          new InventoryUnitBuilder()
            .withBranch(Branch.CINERE)
            .withModel(`Cinere Unit ${i}`)
            .withPrice(200_000_000)
            .build(),
        ),
      );
    }
  });

  it("getAll() returns every unit", () => {
    expect(query.getAll()).toHaveLength(9);
  });

  it("getById() finds a stored unit", () => {
    const [unit] = query.getAll();
    expect(unwrap(query.getById(unit!.id))).toBe(unit);
  });

  it("getById() returns UnitNotFoundError for an unknown id", () => {
    expect(unwrapErr(query.getById(UnitId.generate())).message).toContain("No InventoryUnit found");
  });

  it("getByBranch(BINTARO) returns 4 available + 1 reserved (spec pinned example)", () => {
    const units = query.getByBranch(Branch.BINTARO);
    expect(units).toHaveLength(4);
    expect(units.filter((u) => u.status === UnitStatus.AVAILABLE)).toHaveLength(3);
    expect(units.filter((u) => u.status === UnitStatus.RESERVED)).toHaveLength(1);
  });

  it("getByModel() fuzzy-matches case-insensitively", () => {
    expect(query.getByModel("xpander")).toHaveLength(2);
  });

  it("getByBrand() fuzzy-matches case-insensitively", () => {
    expect(query.getByBrand("honda")).toHaveLength(1);
  });

  it("getAvailable() returns only AVAILABLE units", () => {
    const available = query.getAvailable();
    expect(available.every((u) => u.status === UnitStatus.AVAILABLE)).toBe(true);
    expect(available).toHaveLength(8);
  });

  it("getAvailableByBranch() combines both filters", () => {
    const available = query.getAvailableByBranch(Branch.BINTARO);
    expect(available).toHaveLength(3);
  });

  it("getByPriceRange(100jt, 199jt) returns units within range", () => {
    const units = query.getByPriceRange(100_000_000, 199_000_000);
    expect(
      units.every((u) => u.price.toNumber() >= 100_000_000 && u.price.toNumber() <= 199_000_000),
    ).toBe(true);
    expect(units).toHaveLength(3);
  });

  it("getByCriteria({ brand: 'Honda', maxPrice: 160jt }) matches Brio only (spec pinned example)", () => {
    const units = query.getByCriteria({ brand: "Honda", maxPrice: 160_000_000 });
    expect(units).toHaveLength(1);
    expect(units[0]!.model.toString()).toBe("Brio RS");
  });

  it("getByCriteria() applies branch filter", () => {
    expect(query.getByCriteria({ branch: Branch.CINERE })).toHaveLength(5);
  });

  it("getByCriteria() applies model filter", () => {
    expect(query.getByCriteria({ model: "Xpander" })).toHaveLength(2);
  });

  it("getByCriteria() applies minPrice filter", () => {
    // Cinere's 5 units at exactly 200jt + Bintaro's Xpander Exceed at 210jt.
    expect(query.getByCriteria({ minPrice: 200_000_000 })).toHaveLength(6);
  });

  it("getByCriteria() applies maxKilometer filter", () => {
    expect(query.getByCriteria({ maxKilometer: 1 })).toHaveLength(0);
  });

  it("getByCriteria() applies transmission filter", () => {
    expect(query.getByCriteria({ transmission: UnitTransmission.AT })).toHaveLength(9);
    expect(query.getByCriteria({ transmission: UnitTransmission.MT })).toHaveLength(0);
  });

  it("getByCriteria() applies status filter", () => {
    expect(query.getByCriteria({ status: UnitStatus.RESERVED })).toHaveLength(1);
  });

  it("getByCriteria() with no filters returns everything", () => {
    expect(query.getByCriteria({})).toHaveLength(9);
  });

  it("countByBranch() = { BINTARO: 4, CINERE: 5, ... } (spec pinned example)", () => {
    const counts = query.countByBranch();
    expect(counts[Branch.BINTARO]).toBe(4);
    expect(counts[Branch.CINERE]).toBe(5);
    expect(counts[Branch.BANDUNG]).toBe(0);
  });

  it("countByModel() counts occurrences per model name", () => {
    const counts = query.countByModel();
    expect(counts["Xpander Cross"]).toBe(1);
  });

  it("getLowestPriceByModel('Xpander') returns the cheaper of the two Xpanders (spec pinned example: 195_000_000)", () => {
    const lowest = query.getLowestPriceByModel("Xpander");
    expect(lowest?.toNumber()).toBe(195_000_000);
  });

  it("getLowestPriceByModel() returns undefined when no unit matches", () => {
    expect(query.getLowestPriceByModel("Nonexistent")).toBeUndefined();
  });

  it("getLowestPriceByModel() finds a later, cheaper match (not just the first)", () => {
    store.upsert(
      unwrap(new InventoryUnitBuilder().withModel("Cinere Unit 0").withPrice(50_000_000).build()),
    );
    const lowest = query.getLowestPriceByModel("Cinere Unit 0");
    expect(lowest?.toNumber()).toBe(50_000_000);
  });

  it("getTotalInventoryValue() sums every unit's price", () => {
    const total = query.getTotalInventoryValue();
    const expected = query.getAll().reduce((sum, unit) => sum + unit.price.toNumber(), 0);
    expect(total.toNumber()).toBe(expected);
  });

  it("getTotalInventoryValue() is 0 for an empty store", () => {
    const emptyQuery = new InventoryQueryService(new InMemoryInventoryStore());
    expect(emptyQuery.getTotalInventoryValue().toNumber()).toBe(0);
  });
});

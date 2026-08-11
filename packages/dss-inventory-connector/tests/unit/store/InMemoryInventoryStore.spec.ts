import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { InventoryUnitBuilder } from "../../../src/builders/InventoryUnitBuilder.js";
import { InventoryUnit } from "../../../src/domain/entities/InventoryUnit.js";
import { UnitId } from "../../../src/domain/value-objects/UnitId.js";
import { UnitPrice } from "../../../src/domain/value-objects/UnitPrice.js";
import { InMemoryInventoryStore } from "../../../src/infrastructure/store/InMemoryInventoryStore.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("InMemoryInventoryStore", () => {
  it("upsert() then getById() returns the same unit", () => {
    const store = new InMemoryInventoryStore();
    const unit = unwrap(new InventoryUnitBuilder().build());
    store.upsert(unit);
    expect(unwrap(store.getById(unit.id))).toBe(unit);
  });

  it("getById() returns UnitNotFoundError for an unknown id", () => {
    const store = new InMemoryInventoryStore();
    const error = unwrapErr(store.getById(UnitId.generate()));
    expect(error.message).toContain("No InventoryUnit found");
  });

  it("upsert() replaces an existing unit with the same id", () => {
    const store = new InMemoryInventoryStore();
    const first = unwrap(new InventoryUnitBuilder().build());
    const second = unwrap(
      InventoryUnit.create({
        id: first.id,
        dmsUnitId: first.dmsUnitId,
        brand: first.brand,
        model: first.model,
        variant: first.variant,
        year: first.year,
        transmission: first.transmission,
        color: first.color,
        kilometer: first.kilometer,
        price: unwrap(UnitPrice.create(999)),
        condition: first.condition,
        status: first.status,
        branch: first.branch,
        photos: first.photos,
        features: first.features,
        sourceSystem: first.sourceSystem,
        sourcePriority: first.sourcePriority,
        syncedAt: first.syncedAt,
        createdAt: first.createdAt,
        updatedAt: first.updatedAt,
      }),
    );
    store.upsert(first);
    store.upsert(second);
    expect(store.size()).toBe(1);
    expect(unwrap(store.getById(first.id)).price.toNumber()).toBe(999);
  });

  it("getAll() returns every stored unit", () => {
    const store = new InMemoryInventoryStore();
    const a = unwrap(new InventoryUnitBuilder().build());
    const b = unwrap(new InventoryUnitBuilder().build());
    store.upsert(a);
    store.upsert(b);
    expect(store.getAll()).toHaveLength(2);
  });

  it("getByBranch() filters by branch", () => {
    const store = new InMemoryInventoryStore();
    const bintaro = unwrap(new InventoryUnitBuilder().withBranch(Branch.BINTARO).build());
    const cinere = unwrap(new InventoryUnitBuilder().withBranch(Branch.CINERE).build());
    store.upsert(bintaro);
    store.upsert(cinere);
    expect(store.getByBranch(Branch.BINTARO)).toEqual([bintaro]);
  });

  it("getByModel() does a case-insensitive substring match", () => {
    const store = new InMemoryInventoryStore();
    const xpander = unwrap(new InventoryUnitBuilder().withModel("Xpander Cross").build());
    store.upsert(xpander);
    expect(store.getByModel("xpander")).toEqual([xpander]);
    expect(store.getByModel("Avanza")).toEqual([]);
  });

  it("remove() deletes a unit", () => {
    const store = new InMemoryInventoryStore();
    const unit = unwrap(new InventoryUnitBuilder().build());
    store.upsert(unit);
    store.remove(unit.id);
    expect(store.size()).toBe(0);
    expect(unwrapErr(store.getById(unit.id))).toBeDefined();
  });

  it("size() reflects the current count", () => {
    const store = new InMemoryInventoryStore();
    expect(store.size()).toBe(0);
    store.upsert(unwrap(new InventoryUnitBuilder().build()));
    expect(store.size()).toBe(1);
  });
});

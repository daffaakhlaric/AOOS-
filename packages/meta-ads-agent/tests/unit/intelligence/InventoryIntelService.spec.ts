import { InventoryUnitBuilder } from "@aos/dss-inventory-connector";
import { describe, expect, it } from "vitest";

import { AdAngle } from "../../../src/domain/value-objects/AdAngle.js";
import {
  InventoryIntelService,
  type PropertyListingSnapshot,
} from "../../../src/intelligence/InventoryIntelService.js";

function buildUnit(model: string, createdAt: Date) {
  const result = new InventoryUnitBuilder().withModel(model).withCreatedAt(createdAt).build();
  if (!result.ok) {
    throw new Error(`fixture build failed: ${result.error.message}`);
  }
  return result.value;
}

const NOW = new Date("2026-06-15T00:00:00.000Z");
const OLD = new Date("2026-01-01T00:00:00.000Z");

describe("InventoryIntelService.automotiveSignals", () => {
  it("flags low stock when a model has <= threshold available units", () => {
    const units = [buildUnit("Xpander Cross", OLD), buildUnit("Xpander Cross", OLD)];
    const signal = InventoryIntelService.automotiveSignals(units);
    expect(signal.hasLowStock).toBe(true);
    expect(signal.lowStockModels).toEqual(["Xpander Cross"]);
    expect(signal.recommendedAngle).toBe(AdAngle.GUDANGNYA);
  });

  it("does not flag low stock when a model has more than threshold units", () => {
    const units = [
      buildUnit("Xpander Cross", OLD),
      buildUnit("Xpander Cross", OLD),
      buildUnit("Xpander Cross", OLD),
    ];
    const signal = InventoryIntelService.automotiveSignals(units, 2);
    expect(signal.hasLowStock).toBe(false);
    expect(signal.lowStockModels).toEqual([]);
  });

  it("flags new arrivals via ageInDays and recommends DISCOVERY when no low stock", () => {
    const recent = new InventoryUnitBuilder()
      .withModel("Brio")
      .withCreatedAt(new Date())
      .withUpdatedAt(new Date())
      .build();
    if (!recent.ok) throw new Error("fixture failed");
    const units = [recent.value, recent.value, recent.value];
    const signal = InventoryIntelService.automotiveSignals(units);
    expect(signal.hasNewArrivals).toBe(true);
    expect(signal.newArrivalUnits.length).toBe(3);
    expect(signal.recommendedAngle).toBe(AdAngle.DISCOVERY);
  });

  it("falls back to DP_RINGAN when there is no low stock and no new arrivals", () => {
    const old = new InventoryUnitBuilder()
      .withModel("Avanza")
      .withCreatedAt(new Date("2020-01-01T00:00:00.000Z"))
      .build();
    if (!old.ok) throw new Error("fixture failed");
    const units = [old.value, old.value, old.value];
    const signal = InventoryIntelService.automotiveSignals(units);
    expect(signal.hasLowStock).toBe(false);
    expect(signal.hasNewArrivals).toBe(false);
    expect(signal.recommendedAngle).toBe(AdAngle.DP_RINGAN);
  });

  it("flags slow-moving units (>= 30 days old) regardless of campaign association (uncomputable, see docstring)", () => {
    const veryOld = new InventoryUnitBuilder()
      .withModel("Avanza")
      .withCreatedAt(new Date("2020-01-01T00:00:00.000Z"))
      .build();
    if (!veryOld.ok) throw new Error("fixture failed");
    const units = [veryOld.value, veryOld.value, veryOld.value];
    const signal = InventoryIntelService.automotiveSignals(units);
    expect(signal.slowMovingUnits.length).toBe(3);
  });

  it("returns empty signals for an empty unit list", () => {
    const signal = InventoryIntelService.automotiveSignals([]);
    expect(signal.hasLowStock).toBe(false);
    expect(signal.hasNewArrivals).toBe(false);
    expect(signal.slowMovingUnits).toEqual([]);
    expect(signal.recommendedAngle).toBe(AdAngle.DP_RINGAN);
  });
});

describe("InventoryIntelService.propertySignals", () => {
  function listing(overrides: Partial<PropertyListingSnapshot> = {}): PropertyListingSnapshot {
    return {
      id: "listing-1",
      title: "Rumah Cinere 2 Lantai",
      listingStatus: "AKTIF",
      createdAt: OLD,
      ...overrides,
    };
  }

  it("counts only AKTIF listings as active", () => {
    const listings = [listing({ listingStatus: "AKTIF" }), listing({ listingStatus: "DRAFT" })];
    const signal = InventoryIntelService.propertySignals(listings, "AKTIF", 7, NOW);
    expect(signal.totalActive).toBe(1);
  });

  it("flags new listings within newListingDays and recommends READY_HUNI", () => {
    const listings = [
      listing({ title: "Baru Ready", createdAt: new Date("2026-06-10T00:00:00.000Z") }),
    ];
    const signal = InventoryIntelService.propertySignals(listings, "AKTIF", 7, NOW);
    expect(signal.newListings).toEqual(["Baru Ready"]);
    expect(signal.recommendedAngle).toBe("READY_HUNI");
  });

  it("falls back to DP_RINGAN when there are no new listings", () => {
    const listings = [listing({ createdAt: OLD })];
    const signal = InventoryIntelService.propertySignals(listings, "AKTIF", 7, NOW);
    expect(signal.newListings).toEqual([]);
    expect(signal.recommendedAngle).toBe("DP_RINGAN");
  });

  it("returns empty signals for an empty listing list", () => {
    const signal = InventoryIntelService.propertySignals([]);
    expect(signal.totalActive).toBe(0);
    expect(signal.newListings).toEqual([]);
    expect(signal.recommendedAngle).toBe("DP_RINGAN");
  });
});

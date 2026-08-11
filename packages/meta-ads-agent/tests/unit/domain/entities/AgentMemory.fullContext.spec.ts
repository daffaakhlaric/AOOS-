import { Branch, Funnel } from "@aos/meta-ads-connector";
import {
  ScrapedKilometer,
  ScrapedPrice,
  ScrapedPromo,
  ScrapeTimestamp,
  ScrapedUnit,
  UnitUrl,
} from "@aos/mobix-web-scraper";
import { describe, expect, it } from "vitest";

import { AgentMemory } from "../../../../src/domain/entities/AgentMemory.js";
import { AdAngle } from "../../../../src/domain/value-objects/AdAngle.js";
import { performanceBaselineKey } from "../../../../src/domain/value-objects/PerformanceBaseline.js";
import { unwrap } from "../../../helpers/result.js";

const clock = () => new Date("2026-08-09T00:00:00.000Z");

function unit(model: string, branch: Branch): ScrapedUnit {
  return unwrap(
    ScrapedUnit.create({
      url: unwrap(UnitUrl.create(`https://mobixbydss.id/unit/${model.toLowerCase()}`)),
      model,
      brand: "Toyota",
      year: 2021,
      transmission: "AT",
      color: "Putih",
      kilometer: unwrap(ScrapedKilometer.create(20_000)),
      price: unwrap(ScrapedPrice.create(180_000_000)),
      branch,
      photos: [],
      available: true,
      scrapedAt: ScrapeTimestamp.now(clock),
    }),
  );
}

describe("AgentMemory — AAOS-W1D-S1S2 (S1) historical learning fields", () => {
  it("starts with historicalLearned false and empty collections", () => {
    const memory = new AgentMemory();
    expect(memory.historicalLearned).toBe(false);
    expect(memory.performanceBaselines.size).toBe(0);
    expect(memory.evergreenAds.size).toBe(0);
    expect(memory.fatiguePatterns.size).toBe(0);
    expect(memory.topAngles).toHaveLength(0);
  });

  it("seedHistoricalLearnings() populates every S1 field and flips historicalLearned to true", () => {
    const memory = new AgentMemory();
    const key = performanceBaselineKey(Branch.CINERE, Funnel.CTWA, AdAngle.DP_RINGAN);
    memory.seedHistoricalLearnings({
      performanceBaselines: new Map([
        [
          key,
          {
            branch: Branch.CINERE,
            funnel: Funnel.CTWA,
            angle: AdAngle.DP_RINGAN,
            avgRphChat: 8964,
            sampleSize: 50,
          },
        ],
      ]),
      evergreenAdIds: ["ad-1", "ad-2"],
      fatiguePatterns: new Map([[Funnel.CTWA, 28]]),
      seasonalPatterns: new Map([[9, 1.4]]),
      topAngles: [AdAngle.DP_RINGAN, AdAngle.GUDANGNYA],
    });

    expect(memory.historicalLearned).toBe(true);
    expect(memory.performanceBaselines.get(key)?.avgRphChat).toBe(8964);
    expect(memory.evergreenAds.has("ad-1")).toBe(true);
    expect(memory.evergreenAds.has("ad-2")).toBe(true);
    expect(memory.fatiguePatterns.get(Funnel.CTWA)).toBe(28);
    expect(memory.seasonalPatterns.get(9)).toBe(1.4);
    expect(memory.topAngles).toEqual([AdAngle.DP_RINGAN, AdAngle.GUDANGNYA]);
  });

  it("markEvergreen() and seedPerformanceBaseline() mutate incrementally outside seedHistoricalLearnings()", () => {
    const memory = new AgentMemory();
    memory.markEvergreen("ad-solo");
    memory.seedPerformanceBaseline("k1", {
      branch: Branch.BINTARO,
      funnel: Funnel.CTWA,
      avgRphLead: 7059,
      sampleSize: 219,
    });
    expect(memory.evergreenAds.has("ad-solo")).toBe(true);
    expect(memory.performanceBaselines.get("k1")?.avgRphLead).toBe(7059);
  });
});

describe("AgentMemory — AAOS-W1D-S1S2 (S2) inventory + promo fields", () => {
  it("starts with inventoryLoaded false and empty collections", () => {
    const memory = new AgentMemory();
    expect(memory.inventoryLoaded).toBe(false);
    expect(memory.currentInventory).toHaveLength(0);
    expect(memory.activePromos).toHaveLength(0);
    expect(memory.lastInventoryScrapeAt).toBeUndefined();
    expect(memory.newUnitsDetected).toHaveLength(0);
  });

  it("seedInventory() populates currentInventory, lastInventoryScrapeAt, and flips inventoryLoaded", () => {
    const memory = new AgentMemory();
    const units = [unit("Avanza", Branch.CINERE), unit("Avanza", Branch.BANDUNG)];
    memory.seedInventory(units, clock());

    expect(memory.inventoryLoaded).toBe(true);
    expect(memory.currentInventory).toHaveLength(2);
    expect(memory.lastInventoryScrapeAt).toEqual(clock());
  });

  it("inventoryByBranch derives a branch-keyed grouping from currentInventory", () => {
    const memory = new AgentMemory();
    memory.seedInventory(
      [unit("Avanza", Branch.CINERE), unit("Avanza", Branch.BANDUNG), unit("Brio", Branch.CINERE)],
      clock(),
    );
    expect(memory.inventoryByBranch.get(Branch.CINERE)).toHaveLength(2);
    expect(memory.inventoryByBranch.get(Branch.BANDUNG)).toHaveLength(1);
  });

  it("inventoryByModel derives a model-keyed grouping from currentInventory", () => {
    const memory = new AgentMemory();
    memory.seedInventory(
      [unit("Avanza", Branch.CINERE), unit("Avanza", Branch.BANDUNG), unit("Brio", Branch.CINERE)],
      clock(),
    );
    expect(memory.inventoryByModel.get("Avanza")).toHaveLength(2);
    expect(memory.inventoryByModel.get("Brio")).toHaveLength(1);
  });

  it("seedPromos() populates activePromos", () => {
    const memory = new AgentMemory();
    const promo = unwrap(
      ScrapedPromo.create({
        title: "DP Ringan",
        description: "desc",
        scrapedAt: ScrapeTimestamp.now(clock),
      }),
    );
    memory.seedPromos([promo]);
    expect(memory.activePromos).toHaveLength(1);
    expect(memory.activePromos[0]?.title).toBe("DP Ringan");
  });

  it("seedNewUnitsDetected() populates newUnitsDetected", () => {
    const memory = new AgentMemory();
    memory.seedNewUnitsDetected([{ model: "Brio", year: 2023, branch: Branch.CINERE }]);
    expect(memory.newUnitsDetected).toHaveLength(1);
    expect(memory.newUnitsDetected[0]?.model).toBe("Brio");
  });
});

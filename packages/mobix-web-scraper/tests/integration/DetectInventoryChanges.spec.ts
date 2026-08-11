import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { DetectInventoryChanges } from "../../src/application/use-cases/DetectInventoryChanges.js";
import { ScrapedUnit } from "../../src/domain/entities/ScrapedUnit.js";
import { ScrapeSession } from "../../src/domain/entities/ScrapeSession.js";
import { MobixScraperEvents } from "../../src/domain/events/MobixScraperEvents.js";
import { ScrapedKilometer } from "../../src/domain/value-objects/ScrapedKilometer.js";
import { ScrapedPrice } from "../../src/domain/value-objects/ScrapedPrice.js";
import { ScrapeTimestamp } from "../../src/domain/value-objects/ScrapeTimestamp.js";
import { UnitUrl } from "../../src/domain/value-objects/UnitUrl.js";
import { createFakePublisher } from "../helpers/publisher.js";

const clock = () => new Date("2026-08-07T00:00:00.000Z");

function unit(slug: string, model: string, branch: Branch): ScrapedUnit {
  const url = UnitUrl.create(`https://mobixbydss.id/unit/${slug}`);
  const km = ScrapedKilometer.create(1000);
  const price = ScrapedPrice.create(150_000_000);
  if (!url.ok || !km.ok || !price.ok) throw new Error("fixture setup failed");
  const result = ScrapedUnit.create({
    url: url.value,
    model,
    brand: "Honda",
    year: 2020,
    transmission: "AT",
    color: "Putih",
    kilometer: km.value,
    price: price.value,
    branch,
    photos: [],
    available: true,
    scrapedAt: ScrapeTimestamp.now(clock),
  });
  if (!result.ok) throw new Error("fixture setup failed");
  return result.value;
}

function session(sessionId: string, units: ScrapedUnit[]): ScrapeSession {
  const result = ScrapeSession.create({
    sessionId,
    units,
    startedAt: clock(),
    completedAt: clock(),
    sourceUrl: "https://mobixbydss.id/unit",
  });
  if (!result.ok) throw new Error("fixture setup failed");
  return result.value;
}

describe("DetectInventoryChanges (integration)", () => {
  it("with no previous session, every unit in the current session counts as new", async () => {
    const publisher = createFakePublisher();
    const events = new MobixScraperEvents(publisher);
    const useCase = new DetectInventoryChanges(events, clock);
    const current = session("s1", [unit("brio-1", "Brio", Branch.CINERE)]);

    const result = await useCase.execute(undefined, current);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.newUnits).toHaveLength(1);
      expect(result.value.soldUnits).toHaveLength(0);
      expect(result.value.unchangedCount).toBe(0);
    }
    expect(
      publisher.published.filter((p) => p.type === "aaos.mobix-scraper.unit.new-detected"),
    ).toHaveLength(1);
  });

  it("detects a new unit added and a unit sold out between sessions", async () => {
    const publisher = createFakePublisher();
    const events = new MobixScraperEvents(publisher);
    const useCase = new DetectInventoryChanges(events, clock);
    const previous = session("s1", [
      unit("brio-1", "Brio", Branch.CINERE),
      unit("xpander-1", "Xpander", Branch.BINTARO),
    ]);
    const current = session("s2", [
      unit("brio-1", "Brio", Branch.CINERE),
      unit("avanza-1", "Avanza", Branch.CINERE),
    ]);

    const result = await useCase.execute(previous, current);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.newUnits.map((u) => u.identityKey)).toEqual(["avanza-1"]);
      expect(result.value.soldUnits.map((u) => u.identityKey)).toEqual(["xpander-1"]);
      expect(result.value.unchangedCount).toBe(1);
    }
    expect(publisher.published.some((p) => p.type === "aaos.mobix-scraper.unit.new-detected")).toBe(
      true,
    );
    expect(publisher.published.some((p) => p.type === "aaos.mobix-scraper.unit.sold-out")).toBe(
      true,
    );
  });

  it("with identical sessions, nothing is new or sold", async () => {
    const publisher = createFakePublisher();
    const events = new MobixScraperEvents(publisher);
    const useCase = new DetectInventoryChanges(events, clock);
    const previous = session("s1", [unit("brio-1", "Brio", Branch.CINERE)]);
    const current = session("s2", [unit("brio-1", "Brio", Branch.CINERE)]);

    const result = await useCase.execute(previous, current);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.newUnits).toHaveLength(0);
      expect(result.value.soldUnits).toHaveLength(0);
      expect(result.value.unchangedCount).toBe(1);
    }
  });

  it("uses the real-time default clock when none is injected", async () => {
    const publisher = createFakePublisher();
    const events = new MobixScraperEvents(publisher);
    const useCase = new DetectInventoryChanges(events);
    const current = session("s1", [unit("brio-1", "Brio", Branch.CINERE)]);

    const result = await useCase.execute(undefined, current);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.newUnits).toHaveLength(1);
  });
});

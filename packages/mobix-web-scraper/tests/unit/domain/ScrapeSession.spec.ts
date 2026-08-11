import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { ScrapedUnit } from "../../../src/domain/entities/ScrapedUnit.js";
import { ScrapeSession } from "../../../src/domain/entities/ScrapeSession.js";
import { ScrapedKilometer } from "../../../src/domain/value-objects/ScrapedKilometer.js";
import { ScrapedPrice } from "../../../src/domain/value-objects/ScrapedPrice.js";
import { ScrapeTimestamp } from "../../../src/domain/value-objects/ScrapeTimestamp.js";
import { UnitUrl } from "../../../src/domain/value-objects/UnitUrl.js";

function makeUnit(slug: string): ScrapedUnit {
  const url = UnitUrl.create(`https://mobixbydss.id/unit/${slug}`);
  const km = ScrapedKilometer.create(1000);
  const price = ScrapedPrice.create(100_000_000);
  if (!url.ok || !km.ok || !price.ok) throw new Error("fixture setup failed");
  const unit = ScrapedUnit.create({
    url: url.value,
    model: "Brio",
    brand: "Honda",
    year: 2020,
    transmission: "AT",
    color: "Merah",
    kilometer: km.value,
    price: price.value,
    branch: Branch.CINERE,
    photos: [],
    available: true,
    scrapedAt: ScrapeTimestamp.now(() => new Date("2026-08-07T00:00:00.000Z")),
  });
  if (!unit.ok) throw new Error("fixture setup failed");
  return unit.value;
}

describe("ScrapeSession", () => {
  it("creates a valid session", () => {
    const result = ScrapeSession.create({
      sessionId: "s1",
      units: [makeUnit("brio-1")],
      startedAt: new Date("2026-08-07T00:00:00.000Z"),
      completedAt: new Date("2026-08-07T00:00:05.000Z"),
      sourceUrl: "https://mobixbydss.id/unit",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.unitCount).toBe(1);
      expect(result.value.startedAt).toBeInstanceOf(Date);
      expect(result.value.completedAt).toBeInstanceOf(Date);
      expect(result.value.sourceUrl).toBe("https://mobixbydss.id/unit");
    }
  });

  it("rejects an empty sessionId", () => {
    const result = ScrapeSession.create({
      sessionId: "",
      units: [],
      startedAt: new Date(),
      completedAt: new Date(),
      sourceUrl: "https://mobixbydss.id/unit",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects completedAt preceding startedAt", () => {
    const result = ScrapeSession.create({
      sessionId: "s1",
      units: [],
      startedAt: new Date("2026-08-07T00:00:05.000Z"),
      completedAt: new Date("2026-08-07T00:00:00.000Z"),
      sourceUrl: "https://mobixbydss.id/unit",
    });
    expect(result.ok).toBe(false);
  });

  it("units getter returns a defensive copy — mutating the props array does not leak", () => {
    const inputUnits = [makeUnit("brio-1")];
    const result = ScrapeSession.create({
      sessionId: "s1",
      units: inputUnits,
      startedAt: new Date(),
      completedAt: new Date(),
      sourceUrl: "https://mobixbydss.id/unit",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      inputUnits.push(makeUnit("brio-2"));
      expect(result.value.unitCount).toBe(1);
    }
  });

  it("byIdentityKey indexes units by their URL slug", () => {
    const unit = makeUnit("brio-1");
    const result = ScrapeSession.create({
      sessionId: "s1",
      units: [unit],
      startedAt: new Date(),
      completedAt: new Date(),
      sourceUrl: "https://mobixbydss.id/unit",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const map = result.value.byIdentityKey();
      expect(map.get("brio-1")).toBe(unit);
    }
  });
});

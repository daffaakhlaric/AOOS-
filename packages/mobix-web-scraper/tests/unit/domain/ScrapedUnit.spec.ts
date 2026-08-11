import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { ScrapedUnit } from "../../../src/domain/entities/ScrapedUnit.js";
import { ScrapedKilometer } from "../../../src/domain/value-objects/ScrapedKilometer.js";
import { ScrapedPrice } from "../../../src/domain/value-objects/ScrapedPrice.js";
import { ScrapeTimestamp } from "../../../src/domain/value-objects/ScrapeTimestamp.js";
import { UnitUrl } from "../../../src/domain/value-objects/UnitUrl.js";

function makeProps(overrides: Partial<Parameters<typeof ScrapedUnit.create>[0]> = {}) {
  const url = UnitUrl.create("https://mobixbydss.id/unit/xpander-cross-2019-abc");
  const km = ScrapedKilometer.create(45_000);
  const price = ScrapedPrice.create(195_000_000);
  if (!url.ok || !km.ok || !price.ok) throw new Error("fixture setup failed");
  return {
    url: url.value,
    model: "Xpander Cross",
    brand: "Mitsubishi",
    year: 2019,
    transmission: "AT" as const,
    color: "Putih",
    kilometer: km.value,
    price: price.value,
    branch: Branch.BINTARO,
    photos: ["https://mobixbydss.id/photos/abc-1.jpg"],
    available: true,
    scrapedAt: ScrapeTimestamp.now(() => new Date("2026-08-07T00:00:00.000Z")),
    ...overrides,
  };
}

describe("ScrapedUnit", () => {
  it("creates a valid unit", () => {
    const result = ScrapedUnit.create(makeProps());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.model).toBe("Xpander Cross");
      expect(result.value.identityKey).toBe("xpander-cross-2019-abc");
      expect(result.value.url.slug).toBe("xpander-cross-2019-abc");
      expect(result.value.scrapedAt.value).toBeInstanceOf(Date);
      expect(result.value.brand).toBe("Mitsubishi");
      expect(result.value.year).toBe(2019);
      expect(result.value.transmission).toBe("AT");
      expect(result.value.color).toBe("Putih");
      expect(result.value.kilometer.km).toBe(45_000);
      expect(result.value.price.idr).toBe(195_000_000);
      expect(result.value.branch).toBe(Branch.BINTARO);
      expect(result.value.available).toBe(true);
    }
  });

  it("rejects an empty model", () => {
    expect(ScrapedUnit.create(makeProps({ model: "" })).ok).toBe(false);
  });

  it("rejects an empty brand", () => {
    expect(ScrapedUnit.create(makeProps({ brand: "  " })).ok).toBe(false);
  });

  it("rejects an implausible year", () => {
    expect(ScrapedUnit.create(makeProps({ year: 1800 })).ok).toBe(false);
  });

  it("rejects an invalid transmission", () => {
    // @ts-expect-error deliberately invalid for the runtime check
    expect(ScrapedUnit.create(makeProps({ transmission: "CVT" })).ok).toBe(false);
  });

  it("matchesModel is case-insensitive substring match", () => {
    const result = ScrapedUnit.create(makeProps());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.matchesModel("xpander")).toBe(true);
      expect(result.value.matchesModel("brio")).toBe(false);
    }
  });

  it("represents an out-of-stock unit with available=false", () => {
    const result = ScrapedUnit.create(makeProps({ available: false }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.available).toBe(false);
  });

  it("rejects a year implausibly far in the future", () => {
    expect(ScrapedUnit.create(makeProps({ year: 2101 })).ok).toBe(false);
  });

  it("photos array is defensively copied", () => {
    const photos = ["https://mobixbydss.id/photos/abc-1.jpg"];
    const result = ScrapedUnit.create(makeProps({ photos }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      photos.push("mutated");
      expect(result.value.photos).toHaveLength(1);
    }
  });
});

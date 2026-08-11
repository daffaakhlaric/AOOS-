import { describe, expect, it } from "vitest";

import { ScrapedPromo } from "../../../src/domain/entities/ScrapedPromo.js";
import { ScrapeTimestamp } from "../../../src/domain/value-objects/ScrapeTimestamp.js";

const scrapedAt = ScrapeTimestamp.now(() => new Date("2026-08-07T00:00:00.000Z"));

describe("ScrapedPromo", () => {
  it("creates a valid promo", () => {
    const result = ScrapedPromo.create({
      title: "DP Ringan Mulai 10 Juta",
      description: "Simulasi kredit transparan",
      scrapedAt,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an empty title", () => {
    expect(ScrapedPromo.create({ title: "", description: "x", scrapedAt }).ok).toBe(false);
  });

  it("rejects a non-string description", () => {
    // @ts-expect-error deliberately invalid for the runtime check
    expect(ScrapedPromo.create({ title: "Promo", description: 123, scrapedAt }).ok).toBe(false);
  });

  it("exposes description and scrapedAt getters", () => {
    const result = ScrapedPromo.create({ title: "Promo", description: "desc", scrapedAt });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.description).toBe("desc");
      expect(result.value.scrapedAt).toBe(scrapedAt);
    }
  });

  it("appliesToUnit defaults to true when unrestricted", () => {
    const result = ScrapedPromo.create({ title: "Promo", description: "d", scrapedAt });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.appliesToUnit("Xpander")).toBe(true);
  });

  it("appliesToUnit is case-insensitive when restricted", () => {
    const result = ScrapedPromo.create({
      title: "Promo",
      description: "d",
      appliesTo: ["Xpander", "Brio"],
      scrapedAt,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.appliesToUnit("xpander")).toBe(true);
      expect(result.value.appliesToUnit("Avanza")).toBe(false);
    }
  });

  it("isActive is true with no validUntil", () => {
    const result = ScrapedPromo.create({ title: "Promo", description: "d", scrapedAt });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.isActive(new Date("2099-01-01"))).toBe(true);
  });

  it("isActive respects validUntil", () => {
    const result = ScrapedPromo.create({
      title: "Promo",
      description: "d",
      validUntil: new Date("2026-08-31"),
      scrapedAt,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.isActive(new Date("2026-08-01"))).toBe(true);
      expect(result.value.isActive(new Date("2026-09-01"))).toBe(false);
    }
  });
});

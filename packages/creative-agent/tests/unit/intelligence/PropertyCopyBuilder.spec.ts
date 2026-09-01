import { describe, expect, it } from "vitest";

import type { PropertyCreativeBrief } from "../../../src/contracts/IPropertyPromptBuilder.js";
import {
  HEADLINE_MAX_LENGTH,
  PRIMARY_TEXT_MAX_LENGTH,
} from "../../../src/domain/entities/CopyVariant.js";
import {
  ALL_PROPERTY_AD_ANGLES,
  PropertyAdAngle,
} from "../../../src/domain/value-objects/PropertyAdAngle.js";
import { PropertyCopyBuilder } from "../../../src/intelligence/PropertyCopyBuilder.js";
import { unwrap } from "../../helpers/result.js";

function buildBrief(overrides: Partial<PropertyCreativeBrief> = {}): PropertyCreativeBrief {
  return {
    listingId: "listing-1",
    listingTitle: "Rumah Bintaro 88m²",
    propertyType: "RUMAH",
    angle: PropertyAdAngle.READY_HUNI,
    branch: "BINTARO",
    waNumber: "+628123456789",
    ...overrides,
  };
}

describe("PropertyCopyBuilder", () => {
  const builder = new PropertyCopyBuilder();

  it("generates exactly 3 variants (A, B, C)", () => {
    const variants = unwrap(builder.buildVariants(buildBrief()));
    expect(variants).toHaveLength(3);
    expect(variants.map((v) => v.variantLabel)).toEqual(["A", "B", "C"]);
  });

  it("all primaryText <= 125 chars, for every angle", () => {
    for (const angle of ALL_PROPERTY_AD_ANGLES) {
      const brief = buildBrief({
        angle,
        listingTitle: "Rumah Modern Cluster Bintaro Sektor 9 Full Furnished Premium",
        highlights: ["Dekat sekolah dan tol", "Bebas banjir"],
      });
      const variants = unwrap(builder.buildVariants(brief));
      for (const variant of variants) {
        expect(variant.primaryText.length).toBeLessThanOrEqual(PRIMARY_TEXT_MAX_LENGTH);
      }
    }
  });

  it("all headline <= 40 chars, for every angle", () => {
    for (const angle of ALL_PROPERTY_AD_ANGLES) {
      const brief = buildBrief({ angle });
      const variants = unwrap(builder.buildVariants(brief));
      for (const variant of variants) {
        expect(variant.headline.length).toBeLessThanOrEqual(HEADLINE_MAX_LENGTH);
      }
    }
  });

  it("all primaryText/headline stay within limits even for a pathologically long listing title", () => {
    const brief = buildBrief({
      listingTitle:
        "Rumah Mewah Cluster Eksklusif Bintaro Sektor 9 Full Furnished Private Pool Premium Edition",
      highlights: ["Sertifikat SHM lengkap dan siap balik nama tanpa proses tambahan apapun"],
    });
    const variants = unwrap(builder.buildVariants(brief));
    for (const variant of variants) {
      expect(variant.primaryText.length).toBeLessThanOrEqual(PRIMARY_TEXT_MAX_LENGTH);
      expect(variant.headline.length).toBeLessThanOrEqual(HEADLINE_MAX_LENGTH);
    }
  });

  it("SYARIAH -> 'syariah' or 'halal' appears in the copy", () => {
    const brief = buildBrief({ angle: PropertyAdAngle.SYARIAH });
    const variants = unwrap(builder.buildVariants(brief));
    const combined = variants
      .map((v) => `${v.primaryText} ${v.headline}`)
      .join(" ")
      .toLowerCase();
    expect(combined.includes("syariah") || combined.includes("halal")).toBe(true);
  });

  it("every variant carries the brief's angle", () => {
    const brief = buildBrief({ angle: PropertyAdAngle.TESTIMONIAL });
    const variants = unwrap(builder.buildVariants(brief));
    for (const variant of variants) {
      expect(variant.angle).toBe(PropertyAdAngle.TESTIMONIAL);
    }
  });

  it("every variant has a non-empty id, distinct across variants", () => {
    const variants = unwrap(builder.buildVariants(buildBrief()));
    const ids = variants.map((v) => v.id);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) {
      expect(id.length).toBeGreaterThan(0);
    }
  });

  it("variant A uses CTA 'Tanya Sekarang'", () => {
    const variants = unwrap(builder.buildVariants(buildBrief()));
    expect(variants[0]?.callToAction).toBe("Tanya Sekarang");
  });

  it("variant B uses CTA 'Pelajari Selanjutnya'", () => {
    const variants = unwrap(builder.buildVariants(buildBrief()));
    expect(variants[1]?.callToAction).toBe("Pelajari Selanjutnya");
  });

  it("variant C uses CTA 'Tanya Sekarang'", () => {
    const variants = unwrap(builder.buildVariants(buildBrief()));
    expect(variants[2]?.callToAction).toBe("Tanya Sekarang");
  });

  it("highlights' first entry appears in variant C's primaryText when there is room", () => {
    const brief = buildBrief({ highlights: ["Dekat sekolah dan tol"] });
    const variants = unwrap(builder.buildVariants(brief));
    expect(variants[2]?.primaryText).toContain("Dekat sekolah dan tol");
  });

  it("highlights is gracefully omitted from variant C when there is no room within the 125-char limit", () => {
    const brief = buildBrief({
      listingTitle: "Rumah Mewah Cluster Eksklusif Bintaro Sektor 9 Full Furnished Private Pool",
      highlights: [
        "Sebuah keunggulan yang sangat panjang dan tidak akan muat dalam batas karakter yang tersisa",
      ],
    });
    const variants = unwrap(builder.buildVariants(brief));
    expect(variants[2]?.primaryText.length).toBeLessThanOrEqual(PRIMARY_TEXT_MAX_LENGTH);
  });

  it("no highlights -> variant B falls back to a generic condition clause", () => {
    const brief = buildBrief({ highlights: undefined });
    const variants = unwrap(builder.buildVariants(brief));
    expect(variants[1]?.primaryText).toContain("Kondisi terawat, siap dicek");
  });

  it("propertyType is reflected in variant A's copy", () => {
    const brief = buildBrief({ propertyType: "APARTEMEN" });
    const variants = unwrap(builder.buildVariants(brief));
    expect(variants[0]?.primaryText.toLowerCase()).toContain("apartemen");
  });

  it("listing title appears in every variant's headline", () => {
    const brief = buildBrief({ listingTitle: "Apartemen Cinere View" });
    const variants = unwrap(builder.buildVariants(brief));
    for (const variant of variants) {
      expect(variant.headline).toContain("Apartemen Cinere View");
    }
  });

  it("PROMO_TERBATAS (price-relevant angle) -> variant A contains the real, correctly-formatted price", () => {
    const brief = buildBrief({ angle: PropertyAdAngle.PROMO_TERBATAS, price: 1_500_000_000 });
    const variants = unwrap(builder.buildVariants(brief));
    expect(variants[0]?.primaryText).toContain("Rp 1.500.000.000");
  });

  it("DP_RINGAN (price-relevant angle) -> variant A contains the real, correctly-formatted price", () => {
    const brief = buildBrief({ angle: PropertyAdAngle.DP_RINGAN, price: 850_000_000 });
    const variants = unwrap(builder.buildVariants(brief));
    expect(variants[0]?.primaryText).toContain("Rp 850.000.000");
  });

  it("a non-price-relevant angle (TESTIMONIAL) never interpolates price into variant A", () => {
    const brief = buildBrief({ angle: PropertyAdAngle.TESTIMONIAL, price: 1_500_000_000 });
    const variants = unwrap(builder.buildVariants(brief));
    expect(variants[0]?.primaryText).not.toContain("Rp");
  });

  it("INVESTASI (location-relevant angle, 'Lokasi strategis') -> variant A contains the real city", () => {
    const brief = buildBrief({ angle: PropertyAdAngle.INVESTASI, city: "Bintaro" });
    const variants = unwrap(builder.buildVariants(brief));
    expect(variants[0]?.primaryText).toContain("di Bintaro");
  });

  it("city is interpolated into variant A regardless of angle", () => {
    const brief = buildBrief({ angle: PropertyAdAngle.EXCLUSIVE, city: "Cinere" });
    const variants = unwrap(builder.buildVariants(brief));
    expect(variants[0]?.primaryText).toContain("di Cinere");
  });

  it("a listing missing price/city degrades gracefully — never 'undefined' or 'NaN' in any variant", () => {
    const brief = buildBrief({
      angle: PropertyAdAngle.PROMO_TERBATAS,
      price: undefined,
      city: undefined,
    });
    const variants = unwrap(builder.buildVariants(brief));
    for (const variant of variants) {
      expect(variant.primaryText).not.toContain("undefined");
      expect(variant.primaryText).not.toContain("NaN");
      expect(variant.headline).not.toContain("undefined");
      expect(variant.headline).not.toContain("NaN");
    }
  });

  it("price present but city absent (and vice versa) never leaks 'undefined'/'NaN'", () => {
    const briefPriceOnly = buildBrief({
      angle: PropertyAdAngle.DP_RINGAN,
      price: 500_000_000,
      city: undefined,
    });
    const briefCityOnly = buildBrief({
      angle: PropertyAdAngle.DP_RINGAN,
      price: undefined,
      city: "Bandung",
    });
    for (const brief of [briefPriceOnly, briefCityOnly]) {
      const variants = unwrap(builder.buildVariants(brief));
      for (const variant of variants) {
        expect(variant.primaryText).not.toContain("undefined");
        expect(variant.primaryText).not.toContain("NaN");
      }
    }
  });
});

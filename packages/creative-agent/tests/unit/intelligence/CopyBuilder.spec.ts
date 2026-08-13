import { AdAngle } from "@aos/meta-ads-agent";
import { describe, expect, it } from "vitest";

import {
  HEADLINE_MAX_LENGTH,
  PRIMARY_TEXT_MAX_LENGTH,
} from "../../../src/domain/entities/CopyVariant.js";
import { CopyBuilder } from "../../../src/intelligence/CopyBuilder.js";
import { buildBrief, XPANDER_PRICE_CONTEXT } from "../../fixtures/creativeBriefFixtures.js";
import { unwrap } from "../../helpers/result.js";

describe("CopyBuilder", () => {
  const builder = new CopyBuilder();

  it("generates exactly 3 variants (A, B, C)", () => {
    const variants = unwrap(builder.buildVariants(buildBrief()));
    expect(variants).toHaveLength(3);
    expect(variants.map((v) => v.variantLabel)).toEqual(["A", "B", "C"]);
  });

  it("all primaryText <= 125 chars, for every angle", () => {
    for (const angle of Object.values(AdAngle)) {
      const brief = buildBrief({
        angle,
        priceContext: XPANDER_PRICE_CONTEXT,
        activePromo: "Gratis Servis 3x",
      });
      const variants = unwrap(builder.buildVariants(brief));
      for (const variant of variants) {
        expect(variant.primaryText.length).toBeLessThanOrEqual(PRIMARY_TEXT_MAX_LENGTH);
      }
    }
  });

  it("all headline <= 40 chars, for every angle", () => {
    for (const angle of Object.values(AdAngle)) {
      const brief = buildBrief({ angle, priceContext: XPANDER_PRICE_CONTEXT });
      const variants = unwrap(builder.buildVariants(brief));
      for (const variant of variants) {
        expect(variant.headline.length).toBeLessThanOrEqual(HEADLINE_MAX_LENGTH);
      }
    }
  });

  it("all primaryText/headline stay within limits even for a pathologically long unit name", () => {
    const brief = buildBrief({
      unit: "Mitsubishi Xpander Cross Ultimate Premium Limited Edition Special Series 2019",
      priceContext: XPANDER_PRICE_CONTEXT,
      activePromo: "Promo spesial akhir tahun dengan bonus aksesoris lengkap dan gratis asuransi",
    });
    const variants = unwrap(builder.buildVariants(brief));
    for (const variant of variants) {
      expect(variant.primaryText.length).toBeLessThanOrEqual(PRIMARY_TEXT_MAX_LENGTH);
      expect(variant.headline.length).toBeLessThanOrEqual(HEADLINE_MAX_LENGTH);
    }
  });

  it("DP_RINGAN + priceContext -> Rp 29jt (29 juta) in copy text", () => {
    const brief = buildBrief({ angle: AdAngle.DP_RINGAN, priceContext: XPANDER_PRICE_CONTEXT });
    const variants = unwrap(builder.buildVariants(brief));
    const combined = variants.map((v) => v.primaryText).join(" ");
    expect(combined).toContain("29 juta");
  });

  it("KREDIT_SYARIAH -> 'syariah' or 'halal' appears in the copy", () => {
    const brief = buildBrief({ angle: AdAngle.KREDIT_SYARIAH });
    const variants = unwrap(builder.buildVariants(brief));
    const combined = variants
      .map((v) => `${v.primaryText} ${v.headline}`)
      .join(" ")
      .toLowerCase();
    expect(combined.includes("syariah") || combined.includes("halal")).toBe(true);
  });

  it("activePromo -> promo text included in variant A or B", () => {
    const brief = buildBrief({
      activePromo: "Gratis Servis 3x",
      priceContext: XPANDER_PRICE_CONTEXT,
    });
    const variants = unwrap(builder.buildVariants(brief));
    const [a, b] = variants;
    expect(
      a?.primaryText.includes("Gratis Servis 3x") || b?.primaryText.includes("Gratis Servis 3x"),
    ).toBe(true);
  });

  it("every variant carries the brief's angle", () => {
    const brief = buildBrief({ angle: AdAngle.TESTIMONIAL });
    const variants = unwrap(builder.buildVariants(brief));
    for (const variant of variants) {
      expect(variant.angle).toBe(AdAngle.TESTIMONIAL);
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

  it("without priceContext, variant A falls back to the brief's primaryMessage", () => {
    const brief = buildBrief({
      priceContext: undefined,
      primaryMessage: "Unit siap pakai, kondisi prima",
    });
    const variants = unwrap(builder.buildVariants(brief));
    expect(variants[0]?.primaryText).toContain("Unit siap pakai, kondisi prima");
  });

  it("uspMessages (COORDINATOR NOTE #4) appears in variant C's primaryText when present and there is room", () => {
    const brief = buildBrief({ unit: "Xpander", uspMessages: ["Servis gratis 3x"] });
    const variants = unwrap(builder.buildVariants(brief));
    expect(variants[2]?.primaryText).toContain("Servis gratis 3x");
  });

  it("uspMessages is gracefully omitted from variant C when there is no room within the 125-char limit", () => {
    const brief = buildBrief({
      unit: "Mitsubishi Xpander Cross Ultimate",
      uspMessages: [
        "A very long unique selling point that will not fit within the remaining budget",
      ],
    });
    const variants = unwrap(builder.buildVariants(brief));
    expect(variants[2]?.primaryText.length).toBeLessThanOrEqual(PRIMARY_TEXT_MAX_LENGTH);
  });

  it("urgency=LOW softens variant A's closing line", () => {
    const brief = buildBrief({ urgency: "LOW" });
    const variants = unwrap(builder.buildVariants(brief));
    expect(variants[0]?.primaryText).toContain("Yuk tanya-tanya dulu kak");
  });

  it("urgency=HIGH uses the stronger 'Stok terbatas' closing line", () => {
    const brief = buildBrief({ urgency: "HIGH" });
    const variants = unwrap(builder.buildVariants(brief));
    expect(variants[0]?.primaryText).toContain("Stok terbatas kak");
  });

  it("business-correctness: the spec's pinned Variant A example text length is <= 125", () => {
    const pinned =
      "Xpander 2019 udah bisa kamu bawa pulang! DP cuma 29 juta, cicilan mulai 5,4 juta/bulan. Stok terbatas kak 😊";
    expect(pinned.length).toBeLessThanOrEqual(PRIMARY_TEXT_MAX_LENGTH);
  });

  it("variant A headline includes the DP amount when priceContext is present", () => {
    const brief = buildBrief({ priceContext: XPANDER_PRICE_CONTEXT, unit: "Xpander" });
    const variants = unwrap(builder.buildVariants(brief));
    expect(variants[0]?.headline).toContain("29 Juta");
  });
});

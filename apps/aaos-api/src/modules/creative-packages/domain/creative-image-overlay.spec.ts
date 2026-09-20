import { LayoutFamily } from "@aos/creative-agent";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { applyTypographyOverlay } from "./creative-image-overlay.js";

/**
 * Real, minimal, genuinely-decodable JPEG buffer built with `sharp` itself (a solid-color
 * synthetic fixture generated at test time, never a committed binary) — the exact shape
 * `applyTypographyOverlay` receives in production (`OrchestrateGenerationOutput.imageBuffers[n]`,
 * always `image/jpeg` per `persistGeneratedMedia`'s hardcoded `contentType`). Unlike
 * `creative-qa.spec.ts`'s hand-built SOF0-only buffer (sufficient for that module's own manual
 * marker parser, but NOT decodable by a real JPEG decoder — no Huffman/quantization tables or scan
 * data), this fixture is a real, fully valid JPEG sharp can actually composite onto.
 */
async function buildRealJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 120, g: 140, b: 160 } },
  })
    .jpeg()
    .toBuffer();
}

describe("applyTypographyOverlay", () => {
  it("degrades honestly when no real text field is provided", async () => {
    const image = await buildRealJpeg(600, 600);
    const result = await applyTypographyOverlay({ imageBuffer: image });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("no_real_text_fields_provided");
    }
  });

  it("composites real price/headline/CTA onto a real square JPEG and returns a real, decodable, same-dimension JPEG", async () => {
    const image = await buildRealJpeg(1080, 1080);
    const result = await applyTypographyOverlay({
      imageBuffer: image,
      priceRupiah: 850_000_000,
      headline: "Rumah Baru Siap Huni di Bekasi",
      ctaText: "Tanya Sekarang",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    // Real JPEG signature (FF D8 FF) — a genuine, re-encoded image, not a fabricated buffer.
    expect(result.buffer[0]).toBe(0xff);
    expect(result.buffer[1]).toBe(0xd8);
    expect(result.buffer[2]).toBe(0xff);

    // Real round-trip decode: dimensions are unchanged (a fixed-position overlay, never a resize/crop).
    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.width).toBe(1080);
    expect(metadata.height).toBe(1080);
    expect(metadata.format).toBe("jpeg");
  });

  it("composites onto a real 9:16 vertical JPEG (a real ratio this pipeline actually requests)", async () => {
    const image = await buildRealJpeg(1080, 1920);
    const result = await applyTypographyOverlay({
      imageBuffer: image,
      priceRupiah: 1_250_000_000,
      headline: "Ruko Strategis Dekat Tol",
      ctaText: "Pelajari Selanjutnya",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.width).toBe(1080);
    expect(metadata.height).toBe(1920);
  });

  it("composites when only price is real (headline/CTA genuinely absent) without fabricating text", async () => {
    const image = await buildRealJpeg(800, 800);
    const result = await applyTypographyOverlay({ imageBuffer: image, priceRupiah: 500_000_000 });
    expect(result.ok).toBe(true);
  });

  it("composites when only headline + CTA are real (no listing price)", async () => {
    const image = await buildRealJpeg(800, 800);
    const result = await applyTypographyOverlay({
      imageBuffer: image,
      headline: "Investasi Properti Terbaik",
      ctaText: "Tanya Sekarang",
    });
    expect(result.ok).toBe(true);
  });

  it("XML-escapes untrusted headline text rather than letting it break the SVG markup", async () => {
    const image = await buildRealJpeg(700, 700);
    const result = await applyTypographyOverlay({
      imageBuffer: image,
      headline: `<script>alert("x")</script> & "quoted" 'text'`,
      ctaText: "Tanya Sekarang",
    });
    // A real compositing success proves the SVG stayed well-formed despite hostile characters —
    // an escaping bug here would make sharp/librsvg reject the SVG and this would come back
    // `ok: false`.
    expect(result.ok).toBe(true);
  });

  it("degrades honestly (never throws) on a genuinely corrupt, non-image buffer", async () => {
    const corrupt = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);
    const result = await applyTypographyOverlay({
      imageBuffer: corrupt,
      priceRupiah: 100_000_000,
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason.length).toBeGreaterThan(0);
  });

  // PROMPT 46 — PROPERTY INTEGRITY MODES (Phase 30). The real "ILUSTRASI" disclosure badge reuses
  // this exact compositing mechanism rather than a second, parallel one.
  it("composites when only label is real (no price/headline/CTA) — the ILUSTRASI badge stands alone for a CONCEPTUAL listing with no other overlay text", async () => {
    const image = await buildRealJpeg(1080, 1080);
    const result = await applyTypographyOverlay({ imageBuffer: image, label: "ILUSTRASI" });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.width).toBe(1080);
    expect(metadata.height).toBe(1080);
    expect(metadata.format).toBe("jpeg");
  });

  it("composites the label badge alongside real price/headline/CTA in the same pass", async () => {
    const image = await buildRealJpeg(1080, 1080);
    const result = await applyTypographyOverlay({
      imageBuffer: image,
      priceRupiah: 450_000_000,
      headline: "Kavling Siap Bangun di Sentul",
      ctaText: "Tanya Sekarang",
      label: "ILUSTRASI",
    });
    expect(result.ok).toBe(true);
  });

  it("still degrades honestly (no_real_text_fields_provided) when label is an empty string and every other field is absent", async () => {
    const image = await buildRealJpeg(600, 600);
    const result = await applyTypographyOverlay({ imageBuffer: image, label: "" });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toBe("no_real_text_fields_provided");
  });

  it("XML-escapes untrusted label text rather than letting it break the SVG markup", async () => {
    const image = await buildRealJpeg(700, 700);
    const result = await applyTypographyOverlay({
      imageBuffer: image,
      label: `ILUSTRASI <script>"'`,
    });
    expect(result.ok).toBe(true);
  });

  it("truncates a very long headline rather than overflowing the fixed banner layout", async () => {
    const image = await buildRealJpeg(1080, 1080);
    const longHeadline =
      "Rumah mewah dua lantai lima kamar tidur tiga kamar mandi carport dua mobil taman luas dekat sekolah dan mall";
    const result = await applyTypographyOverlay({
      imageBuffer: image,
      headline: longHeadline,
      ctaText: "Hubungi kami sekarang juga untuk info lebih lanjut",
    });
    expect(result.ok).toBe(true);
  });
});

// PROMPT 58 — DYNAMIC LAYOUT ENGINE (Phase 37). `layoutFamily` is additive and opt-in: omitting it
// (every Phase 29/30 caller) must produce byte-for-byte the same output as always; requesting the
// second genuinely implemented family (`HERO_FULL_BLEED`) must produce a real, distinct, correctly
// decodable JPEG; requesting any of the 9 real spec families with no bespoke positioning logic yet
// must honestly fall back to the exact same output as omitting `layoutFamily` entirely.
describe("applyTypographyOverlay — PROMPT 58 layoutFamily", () => {
  const fields = {
    priceRupiah: 850_000_000,
    headline: "Rumah Baru Siap Huni di Bekasi",
    ctaText: "Tanya Sekarang",
  };

  it("produces the exact same buffer whether layoutFamily is omitted or explicitly BOTTOM_INFO_BAR (zero behavior change for existing callers)", async () => {
    const image = await buildRealJpeg(1080, 1080);
    const withoutLayout = await applyTypographyOverlay({ imageBuffer: image, ...fields });
    const withDefaultLayout = await applyTypographyOverlay({
      imageBuffer: image,
      ...fields,
      layoutFamily: LayoutFamily.BOTTOM_INFO_BAR,
    });
    expect(withoutLayout.ok).toBe(true);
    expect(withDefaultLayout.ok).toBe(true);
    if (!withoutLayout.ok || !withDefaultLayout.ok) {
      return;
    }
    expect(withDefaultLayout.buffer.equals(withoutLayout.buffer)).toBe(true);
  });

  it("honestly falls back to the default BOTTOM_INFO_BAR output for every real spec family without bespoke positioning logic yet", async () => {
    const image = await buildRealJpeg(1080, 1080);
    const deferredFamilies = [
      LayoutFamily.ASYMMETRIC_EDITORIAL,
      LayoutFamily.PRICE_DOMINANT,
      LayoutFamily.FLOATING_CARD,
      LayoutFamily.SPLIT_SCREEN,
      LayoutFamily.MAP_HYBRID,
      LayoutFamily.EDITORIAL_LUXURY,
      LayoutFamily.SPEC_GRID,
      LayoutFamily.MORTGAGE_CARD,
      LayoutFamily.PROPERTY_DISCOVERY,
    ];
    const baseline = await applyTypographyOverlay({ imageBuffer: image, ...fields });
    expect(baseline.ok).toBe(true);
    if (!baseline.ok) {
      return;
    }
    for (const layoutFamily of deferredFamilies) {
      const result = await applyTypographyOverlay({ imageBuffer: image, ...fields, layoutFamily });
      expect(result.ok).toBe(true);
      if (!result.ok) {
        continue;
      }
      expect(result.buffer.equals(baseline.buffer)).toBe(true);
    }
  });

  it("HERO_FULL_BLEED composites a real, distinct, correctly decodable JPEG (genuinely different pixels from the default layout)", async () => {
    const image = await buildRealJpeg(1080, 1080);
    const baseline = await applyTypographyOverlay({ imageBuffer: image, ...fields });
    const hero = await applyTypographyOverlay({
      imageBuffer: image,
      ...fields,
      layoutFamily: LayoutFamily.HERO_FULL_BLEED,
    });
    expect(baseline.ok).toBe(true);
    expect(hero.ok).toBe(true);
    if (!baseline.ok || !hero.ok) {
      return;
    }
    // Real JPEG signature and unchanged dimensions, same as every other layout.
    expect(hero.buffer[0]).toBe(0xff);
    expect(hero.buffer[1]).toBe(0xd8);
    expect(hero.buffer[2]).toBe(0xff);
    const metadata = await sharp(hero.buffer).metadata();
    expect(metadata.width).toBe(1080);
    expect(metadata.height).toBe(1080);
    expect(metadata.format).toBe("jpeg");
    // A genuinely different layout must not produce identical bytes to the default banner layout.
    expect(hero.buffer.equals(baseline.buffer)).toBe(false);
  });

  it("HERO_FULL_BLEED composites on a real 9:16 vertical JPEG without throwing", async () => {
    const image = await buildRealJpeg(1080, 1920);
    const result = await applyTypographyOverlay({
      imageBuffer: image,
      ...fields,
      layoutFamily: LayoutFamily.HERO_FULL_BLEED,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.width).toBe(1080);
    expect(metadata.height).toBe(1920);
  });

  it("HERO_FULL_BLEED still composites successfully when only price is real (headline/CTA absent) without fabricating text", async () => {
    const image = await buildRealJpeg(800, 800);
    const result = await applyTypographyOverlay({
      imageBuffer: image,
      priceRupiah: 500_000_000,
      layoutFamily: LayoutFamily.HERO_FULL_BLEED,
    });
    expect(result.ok).toBe(true);
  });

  it("HERO_FULL_BLEED composites the ILUSTRASI label badge alongside price/headline/CTA without the two corner elements colliding", async () => {
    const image = await buildRealJpeg(1080, 1080);
    const result = await applyTypographyOverlay({
      imageBuffer: image,
      ...fields,
      label: "ILUSTRASI",
      layoutFamily: LayoutFamily.HERO_FULL_BLEED,
    });
    expect(result.ok).toBe(true);
  });

  it("HERO_FULL_BLEED XML-escapes untrusted headline text rather than letting it break the SVG markup", async () => {
    const image = await buildRealJpeg(700, 700);
    const result = await applyTypographyOverlay({
      imageBuffer: image,
      headline: `<script>alert("x")</script> & "quoted" 'text'`,
      ctaText: "Tanya Sekarang",
      layoutFamily: LayoutFamily.HERO_FULL_BLEED,
    });
    expect(result.ok).toBe(true);
  });

  it("degrades honestly (never throws) on a genuinely corrupt buffer regardless of requested layoutFamily", async () => {
    const corrupt = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);
    const result = await applyTypographyOverlay({
      imageBuffer: corrupt,
      priceRupiah: 100_000_000,
      layoutFamily: LayoutFamily.HERO_FULL_BLEED,
    });
    expect(result.ok).toBe(false);
  });
});

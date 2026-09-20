import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { adaptToAspectRatio } from "./format-adaptation.js";

/**
 * Real, minimal, genuinely-decodable JPEG buffer built with `sharp` itself — the same fixture
 * technique `creative-image-overlay.spec.ts` already established (a solid-color synthetic image
 * generated at test time, never a committed binary, but a fully valid JPEG a real decoder can
 * round-trip and `sharp().extract()` can genuinely crop).
 */
async function buildRealJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 90, g: 110, b: 130 } },
  })
    .jpeg()
    .toBuffer();
}

describe("adaptToAspectRatio", () => {
  it("crops a real square 1080x1080 source down to a real 9:16 vertical variant", async () => {
    const image = await buildRealJpeg(1080, 1080);
    const result = await adaptToAspectRatio(image, "9:16");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.technique).toBe("smart_center_crop");
    // Real JPEG signature — a genuine re-encoded image, not a fabricated buffer.
    expect(result.buffer[0]).toBe(0xff);
    expect(result.buffer[1]).toBe(0xd8);
    expect(result.buffer[2]).toBe(0xff);

    // Real round-trip decode: dimensions genuinely match the 9:16 ratio (never a stretch).
    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.width).toBe(result.width);
    expect(metadata.height).toBe(result.height);
    expect(metadata.width).toBeLessThanOrEqual(1080);
    expect(metadata.height).toBe(1080);
    const actualRatio = (metadata.width ?? 0) / (metadata.height ?? 1);
    expect(actualRatio).toBeCloseTo(9 / 16, 2);
  });

  it("crops a real square source down to a real 4:5 portrait variant", async () => {
    const image = await buildRealJpeg(1000, 1000);
    const result = await adaptToAspectRatio(image, "4:5");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.height).toBe(1000);
    const actualRatio = (metadata.width ?? 0) / (metadata.height ?? 1);
    expect(actualRatio).toBeCloseTo(4 / 5, 2);
  });

  it("crops a real wide 1920x1080 source down to a real 1:1 square variant, trimming width only", async () => {
    const image = await buildRealJpeg(1920, 1080);
    const result = await adaptToAspectRatio(image, "1:1");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.height).toBe(1080);
    expect(result.width).toBeLessThanOrEqual(1080);
    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.width).toBe(metadata.height);
  });

  it("is a genuine no-op full-frame extract when the source is already the target ratio", async () => {
    const image = await buildRealJpeg(1080, 1080);
    const result = await adaptToAspectRatio(image, "1:1");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.width).toBe(1080);
    expect(result.height).toBe(1080);
  });

  it("degrades honestly on a corrupt, undecodable buffer instead of throwing", async () => {
    const corrupt = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);
    const result = await adaptToAspectRatio(corrupt, "9:16");

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it("degrades honestly on an empty buffer instead of throwing", async () => {
    const result = await adaptToAspectRatio(Buffer.alloc(0), "4:5");

    expect(result.ok).toBe(false);
  });
});

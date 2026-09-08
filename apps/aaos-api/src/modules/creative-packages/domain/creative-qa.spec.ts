import { AspectRatio } from "@aos/creative-connector";
import { describe, expect, it } from "vitest";

import { runQaChecks } from "./creative-qa.js";

/** Builds a real, minimal-but-structurally-valid JPEG buffer with a genuine SOF0 marker carrying `width`/`height` — the exact real bytes `parseJpegDimensions` reads. `totalSize` pads the buffer (after the header, before EOI) so the real `MIN_IMAGE_BYTES` floor can be exercised honestly. */
function buildJpegBuffer(width: number, height: number, totalSize = 6_000): Buffer {
  const soi = Buffer.from([0xff, 0xd8]);
  const app0 = Buffer.from([
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01,
    0x00, 0x00,
  ]);
  const sof0 = Buffer.alloc(13);
  sof0[0] = 0xff;
  sof0[1] = 0xc0;
  sof0.writeUInt16BE(11, 2); // segment length field
  sof0[4] = 0x08; // precision
  sof0.writeUInt16BE(height, 5);
  sof0.writeUInt16BE(width, 7);
  sof0[9] = 0x01; // numComponents
  sof0[10] = 0x01; // component id
  sof0[11] = 0x11; // sampling factors
  sof0[12] = 0x00; // quant table selector
  const eoi = Buffer.from([0xff, 0xd9]);
  const headerLen = soi.length + app0.length + sof0.length + eoi.length;
  const padding = Buffer.alloc(Math.max(0, totalSize - headerLen), 0x00);
  return Buffer.concat([soi, app0, sof0, padding, eoi]);
}

/** A real, minimal ISO-BMFF ("ftyp") signature buffer — the same real MP4 container signature `checkVideoBuffer` looks for. */
function buildMp4Buffer(totalSize = 60_000): Buffer {
  const sizeField = Buffer.alloc(4);
  sizeField.writeUInt32BE(20, 0);
  const ftyp = Buffer.from([0x66, 0x74, 0x79, 0x70]); // "ftyp"
  const brand = Buffer.from([0x69, 0x73, 0x6f, 0x6d]); // "isom"
  const header = Buffer.concat([sizeField, ftyp, brand]);
  const padding = Buffer.alloc(Math.max(0, totalSize - header.length), 0x00);
  return Buffer.concat([header, padding]);
}

describe("runQaChecks", () => {
  it("passes a real 1:1 JPEG at/above the minimum resolution when 1:1 was requested", () => {
    const image = buildJpegBuffer(1080, 1080);
    const result = runQaChecks({
      imageBuffers: [image],
      requestedImageCount: 1,
      imageAspectRatio: AspectRatio.SQUARE,
      videoRequested: false,
    });
    expect(result.passed).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(
      result.checks.some((check) => check.check === "image[0].resolution" && check.passed),
    ).toBe(true);
  });

  it("passes a real 9:16 JPEG + real MP4 video when both were requested", () => {
    const image = buildJpegBuffer(1080, 1920);
    const video = buildMp4Buffer();
    const result = runQaChecks({
      imageBuffers: [image],
      videoBuffer: video,
      requestedImageCount: 1,
      imageAspectRatio: AspectRatio.VERTICAL,
      videoRequested: true,
    });
    expect(result.passed).toBe(true);
  });

  it("fails a buffer smaller than the real minimum byte floor", () => {
    const tiny = buildJpegBuffer(1080, 1080, 100);
    const result = runQaChecks({
      imageBuffers: [tiny],
      requestedImageCount: 1,
      imageAspectRatio: AspectRatio.SQUARE,
      videoRequested: false,
    });
    expect(result.passed).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("image[0].size"))).toBe(true);
  });

  it("fails a buffer with no real JPEG/PNG signature (corrupt/blank)", () => {
    const corrupt = Buffer.alloc(6_000, 0x00);
    const result = runQaChecks({
      imageBuffers: [corrupt],
      requestedImageCount: 1,
      imageAspectRatio: AspectRatio.SQUARE,
      videoRequested: false,
    });
    expect(result.passed).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("image[0].signature"))).toBe(true);
  });

  it("fails a real JPEG below Meta's real minimum resolution floor", () => {
    const small = buildJpegBuffer(300, 300);
    const result = runQaChecks({
      imageBuffers: [small],
      requestedImageCount: 1,
      imageAspectRatio: AspectRatio.SQUARE,
      videoRequested: false,
    });
    expect(result.passed).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("image[0].resolution"))).toBe(true);
  });

  it("fails a real JPEG whose measured aspect ratio doesn't match the requested one", () => {
    const square = buildJpegBuffer(1080, 1080);
    const result = runQaChecks({
      imageBuffers: [square],
      requestedImageCount: 1,
      imageAspectRatio: AspectRatio.VERTICAL,
      videoRequested: false,
    });
    expect(result.passed).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("image[0].aspect_ratio"))).toBe(true);
  });

  it("fails when a video was requested but no video buffer came back", () => {
    const image = buildJpegBuffer(1080, 1080);
    const result = runQaChecks({
      imageBuffers: [image],
      requestedImageCount: 1,
      imageAspectRatio: AspectRatio.SQUARE,
      videoRequested: true,
    });
    expect(result.passed).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("video_present"))).toBe(true);
  });

  it("fails a real video buffer with no real 'ftyp' signature", () => {
    const notMp4 = Buffer.alloc(60_000, 0x00);
    const image = buildJpegBuffer(1080, 1080);
    const result = runQaChecks({
      imageBuffers: [image],
      videoBuffer: notMp4,
      requestedImageCount: 1,
      imageAspectRatio: AspectRatio.SQUARE,
      videoRequested: true,
    });
    expect(result.passed).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("video.signature"))).toBe(true);
  });

  it("fails a too-small real video buffer on the real byte-size floor", () => {
    const image = buildJpegBuffer(1080, 1080);
    const tinyVideo = buildMp4Buffer(100);
    const result = runQaChecks({
      imageBuffers: [image],
      videoBuffer: tinyVideo,
      requestedImageCount: 1,
      imageAspectRatio: AspectRatio.SQUARE,
      videoRequested: true,
    });
    expect(result.passed).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("video.size"))).toBe(true);
  });

  it("fails when no output at all was produced", () => {
    const result = runQaChecks({
      imageBuffers: [],
      requestedImageCount: 1,
      imageAspectRatio: AspectRatio.SQUARE,
      videoRequested: false,
    });
    expect(result.passed).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("output_present"))).toBe(true);
  });
});

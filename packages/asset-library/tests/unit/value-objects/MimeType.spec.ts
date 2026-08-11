import { describe, expect, it } from "vitest";

import { MimeType } from "../../../src/domain/value-objects/MimeType.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("MimeType", () => {
  describe("pinned business-correctness file_validation matrix", () => {
    it.each([
      ["image/jpeg", true],
      ["image/png", true],
      ["image/webp", true],
      ["video/mp4", true],
    ])("%s -> valid", (raw, expected) => {
      const result = MimeType.create(raw);
      expect(result.ok).toBe(expected);
    });

    it.each(["image/gif", "application/pdf"])(
      "%s -> InvalidFileTypeError-eligible (create fails)",
      (raw) => {
        const error = unwrapErr(MimeType.create(raw));
        expect(error.message).toContain("MimeType");
      },
    );
  });

  it("isImage()/isVideo() classify correctly", () => {
    const jpeg = unwrap(MimeType.create("image/jpeg"));
    const mp4 = unwrap(MimeType.create("video/mp4"));
    expect(jpeg.isImage()).toBe(true);
    expect(jpeg.isVideo()).toBe(false);
    expect(mp4.isImage()).toBe(false);
    expect(mp4.isVideo()).toBe(true);
  });

  it("extension() maps each allowed MIME type to its conventional extension", () => {
    expect(unwrap(MimeType.create("image/jpeg")).extension()).toBe("jpg");
    expect(unwrap(MimeType.create("image/png")).extension()).toBe("png");
    expect(unwrap(MimeType.create("image/webp")).extension()).toBe("webp");
    expect(unwrap(MimeType.create("video/mp4")).extension()).toBe("mp4");
  });

  it("toString() renders the raw MIME string", () => {
    expect(unwrap(MimeType.create("image/jpeg")).toString()).toBe("image/jpeg");
  });

  it("equals() compares by value", () => {
    const a = unwrap(MimeType.create("image/jpeg"));
    const b = unwrap(MimeType.create("image/jpeg"));
    const c = unwrap(MimeType.create("image/png"));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});

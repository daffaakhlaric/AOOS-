import { describe, expect, it } from "vitest";

import { FileSize } from "../../../src/domain/value-objects/FileSize.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const IMAGE_MAX = 10 * 1024 * 1024;
const VIDEO_MAX = 100 * 1024 * 1024;

describe("FileSize", () => {
  it("create() accepts a non-negative integer", () => {
    const size = unwrap(FileSize.create(0));
    expect(size.bytes).toBe(0);
  });

  it("create() rejects a negative number", () => {
    const error = unwrapErr(FileSize.create(-1));
    expect(error.message).toContain("FileSize");
  });

  it("create() rejects a non-integer number", () => {
    const error = unwrapErr(FileSize.create(1.5));
    expect(error.message).toContain("FileSize");
  });

  it("toString() renders the byte count", () => {
    const size = unwrap(FileSize.create(1024));
    expect(size.toString()).toBe("1024");
  });

  it("equals() compares by value", () => {
    const a = unwrap(FileSize.create(1024));
    const b = unwrap(FileSize.create(1024));
    const c = unwrap(FileSize.create(2048));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  describe("exceeds() — pinned business-correctness size_limit boundaries", () => {
    it("10MB exactly does NOT exceed the 10MB image limit", () => {
      const size = unwrap(FileSize.create(IMAGE_MAX));
      expect(size.exceeds(IMAGE_MAX)).toBe(false);
    });

    it("10MB + 1 byte DOES exceed the 10MB image limit", () => {
      const size = unwrap(FileSize.create(IMAGE_MAX + 1));
      expect(size.exceeds(IMAGE_MAX)).toBe(true);
    });

    it("100MB exactly does NOT exceed the 100MB video limit", () => {
      const size = unwrap(FileSize.create(VIDEO_MAX));
      expect(size.exceeds(VIDEO_MAX)).toBe(false);
    });

    it("100MB + 1 byte DOES exceed the 100MB video limit", () => {
      const size = unwrap(FileSize.create(VIDEO_MAX + 1));
      expect(size.exceeds(VIDEO_MAX)).toBe(true);
    });
  });
});

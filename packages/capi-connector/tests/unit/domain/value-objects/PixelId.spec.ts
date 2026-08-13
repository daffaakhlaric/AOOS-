import { describe, expect, it } from "vitest";

import { PixelId } from "../../../../src/domain/value-objects/PixelId.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("PixelId", () => {
  it("creates a PixelId from a non-empty string", () => {
    const pixelId = unwrap(PixelId.create("123456789"));
    expect(pixelId.toString()).toBe("123456789");
  });

  it("rejects an empty string", () => {
    const error = unwrapErr(PixelId.create(""));
    expect(error.message).toContain("PixelId must be a non-empty string");
  });

  it("rejects a whitespace-only string", () => {
    const error = unwrapErr(PixelId.create("   "));
    expect(error.message).toContain("PixelId must be a non-empty string");
  });

  it("equals() compares by value", () => {
    const a = unwrap(PixelId.create("abc"));
    const b = unwrap(PixelId.create("abc"));
    const c = unwrap(PixelId.create("xyz"));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});

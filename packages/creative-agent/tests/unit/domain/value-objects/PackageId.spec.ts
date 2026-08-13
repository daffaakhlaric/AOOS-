import { describe, expect, it } from "vitest";

import { PackageId } from "../../../../src/domain/value-objects/PackageId.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("PackageId", () => {
  it("create() accepts a non-empty string", () => {
    const id = unwrap(PackageId.create("pkg-1"));
    expect(id.toString()).toBe("pkg-1");
  });

  it("create() rejects an empty string", () => {
    const error = unwrapErr(PackageId.create(""));
    expect(error.message).toContain("PackageId");
  });

  it("create() rejects a whitespace-only string", () => {
    const error = unwrapErr(PackageId.create("   "));
    expect(error.message).toContain("non-empty string");
  });

  it("generate() produces a valid UUID", () => {
    const id = PackageId.generate();
    expect(id.toString()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("generate() produces unique ids across calls", () => {
    expect(PackageId.generate().toString()).not.toBe(PackageId.generate().toString());
  });

  it("equals() is true for the same value", () => {
    const a = unwrap(PackageId.create("same"));
    const b = unwrap(PackageId.create("same"));
    expect(a.equals(b)).toBe(true);
  });

  it("equals() is false for different values", () => {
    const a = unwrap(PackageId.create("a"));
    const b = unwrap(PackageId.create("b"));
    expect(a.equals(b)).toBe(false);
  });
});

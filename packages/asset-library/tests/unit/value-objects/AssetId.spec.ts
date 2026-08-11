import { describe, expect, it } from "vitest";

import { AssetId } from "../../../src/domain/value-objects/AssetId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("AssetId", () => {
  it("create() accepts a non-empty string", () => {
    const id = unwrap(AssetId.create("abc-123"));
    expect(id.toString()).toBe("abc-123");
  });

  it("create() rejects an empty string", () => {
    const error = unwrapErr(AssetId.create(""));
    expect(error.message).toContain("AssetId");
  });

  it("create() rejects a whitespace-only string", () => {
    const error = unwrapErr(AssetId.create("   "));
    expect(error.message).toContain("AssetId");
  });

  it("generate() produces a non-empty unique id each call", () => {
    const a = AssetId.generate();
    const b = AssetId.generate();
    expect(a.toString().length).toBeGreaterThan(0);
    expect(a.equals(b)).toBe(false);
  });

  it("equals() compares by value", () => {
    const a = unwrap(AssetId.create("same"));
    const b = unwrap(AssetId.create("same"));
    const c = unwrap(AssetId.create("different"));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});

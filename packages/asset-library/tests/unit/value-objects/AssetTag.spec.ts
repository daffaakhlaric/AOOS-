import { describe, expect, it } from "vitest";

import { AssetTag } from "../../../src/domain/value-objects/AssetTag.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("AssetTag", () => {
  it("create() accepts a non-empty string and trims it", () => {
    const tag = unwrap(AssetTag.create("  branch:BINTARO  "));
    expect(tag.toString()).toBe("branch:BINTARO");
  });

  it("create() rejects an empty string", () => {
    const error = unwrapErr(AssetTag.create(""));
    expect(error.message).toContain("AssetTag");
  });

  it("create() rejects a whitespace-only string", () => {
    const error = unwrapErr(AssetTag.create("   "));
    expect(error.message).toContain("AssetTag");
  });

  it("equals() compares by value", () => {
    const a = unwrap(AssetTag.create("angle:front"));
    const b = unwrap(AssetTag.create("angle:front"));
    const c = unwrap(AssetTag.create("angle:rear"));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { AssetType, parseAssetType } from "../../../src/domain/value-objects/AssetType.js";

describe("AssetType", () => {
  it("has the 6 spec'd members", () => {
    expect(Object.values(AssetType)).toEqual([
      "UNIT_PHOTO",
      "BRAND",
      "TESTIMONIAL",
      "AI_VIDEO",
      "AI_IMAGE",
      "OVERLAY",
    ]);
  });

  describe("parseAssetType", () => {
    it("returns the matching member for a valid raw string", () => {
      expect(parseAssetType("UNIT_PHOTO")).toBe(AssetType.UNIT_PHOTO);
      expect(parseAssetType("BRAND")).toBe(AssetType.BRAND);
    });

    it("returns undefined for an unknown string", () => {
      expect(parseAssetType("NOT_A_TYPE")).toBeUndefined();
    });
  });
});

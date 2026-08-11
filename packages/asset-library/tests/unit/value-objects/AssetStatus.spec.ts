import { describe, expect, it } from "vitest";

import { AssetStatus, parseAssetStatus } from "../../../src/domain/value-objects/AssetStatus.js";

describe("AssetStatus", () => {
  it("has the 3 spec'd members", () => {
    expect(Object.values(AssetStatus)).toEqual(["ACTIVE", "ARCHIVED", "PENDING"]);
  });

  describe("parseAssetStatus", () => {
    it("returns the matching member for a valid raw string", () => {
      expect(parseAssetStatus("ACTIVE")).toBe(AssetStatus.ACTIVE);
      expect(parseAssetStatus("ARCHIVED")).toBe(AssetStatus.ARCHIVED);
    });

    it("returns undefined for an unknown string", () => {
      expect(parseAssetStatus("NOT_A_STATUS")).toBeUndefined();
    });
  });
});

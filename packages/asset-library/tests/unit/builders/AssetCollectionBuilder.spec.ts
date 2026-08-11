import { describe, expect, it } from "vitest";

import { AssetBuilder } from "../../../src/builders/AssetBuilder.js";
import { AssetCollectionBuilder } from "../../../src/builders/AssetCollectionBuilder.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("AssetCollectionBuilder", () => {
  it("build() with no assets produces an empty collection", () => {
    const collection = unwrap(new AssetCollectionBuilder().build());
    expect(collection.isEmpty()).toBe(true);
  });

  it("withAsset() adds one builder at a time", () => {
    const collection = unwrap(
      new AssetCollectionBuilder()
        .withAsset(new AssetBuilder().withFileName("a.jpg"))
        .withAsset(new AssetBuilder().withFileName("b.jpg"))
        .build(),
    );
    expect(collection.count).toBe(2);
  });

  it("withAssets() adds many builders at once", () => {
    const collection = unwrap(
      new AssetCollectionBuilder()
        .withAssets([
          new AssetBuilder().withFileName("a.jpg"),
          new AssetBuilder().withFileName("b.jpg"),
        ])
        .build(),
    );
    expect(collection.count).toBe(2);
  });

  it("build() short-circuits on the first invalid builder", () => {
    const error = unwrapErr(
      new AssetCollectionBuilder()
        .withAsset(new AssetBuilder().withFileName("valid.jpg"))
        .withAsset(new AssetBuilder().withTenantId(""))
        .build(),
    );
    expect(error.message).toContain("tenantId");
  });
});

import { describe, expect, it } from "vitest";

import { AssetBuilder } from "../../../src/builders/AssetBuilder.js";
import { AssetCollection } from "../../../src/domain/entities/AssetCollection.js";
import { unwrap } from "../../helpers/result.js";

describe("AssetCollection", () => {
  it("of() wraps a list of assets", () => {
    const asset = unwrap(new AssetBuilder().build());
    const collection = AssetCollection.of([asset]);
    expect(collection.assets).toEqual([asset]);
    expect(collection.count).toBe(1);
    expect(collection.isEmpty()).toBe(false);
  });

  it("empty() produces an empty collection", () => {
    const collection = AssetCollection.empty();
    expect(collection.count).toBe(0);
    expect(collection.isEmpty()).toBe(true);
  });

  it("sortedByNewest() orders assets by createdAt descending", () => {
    const older = unwrap(
      new AssetBuilder().withCreatedAt(new Date("2026-01-01T00:00:00.000Z")).build(),
    );
    const newer = unwrap(
      new AssetBuilder().withCreatedAt(new Date("2026-02-01T00:00:00.000Z")).build(),
    );
    const collection = AssetCollection.of([older, newer]).sortedByNewest();
    expect(collection.assets).toEqual([newer, older]);
  });

  it("of() defensively copies the input array", () => {
    const asset = unwrap(new AssetBuilder().build());
    const source = [asset];
    const collection = AssetCollection.of(source);
    source.push(asset);
    expect(collection.count).toBe(1);
  });
});

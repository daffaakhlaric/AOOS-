import type { Asset } from "./Asset.js";

/** A grouped, read-only set of `Asset`s returned by query use cases (e.g. all photos for a unit, or a `SaveAiCreative` result set). Spec: "grouped assets per unit". */
export class AssetCollection {
  private constructor(private readonly assetList: ReadonlyArray<Asset>) {}

  static of(assets: ReadonlyArray<Asset>): AssetCollection {
    return new AssetCollection([...assets]);
  }

  static empty(): AssetCollection {
    return new AssetCollection([]);
  }

  get assets(): ReadonlyArray<Asset> {
    return this.assetList;
  }

  get count(): number {
    return this.assetList.length;
  }

  isEmpty(): boolean {
    return this.assetList.length === 0;
  }

  /** Newest-first by `createdAt`, matching `GetAssetsByUnit`'s spec'd ordering. */
  sortedByNewest(): AssetCollection {
    return new AssetCollection(
      [...this.assetList].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    );
  }
}

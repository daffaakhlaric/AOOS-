import type { Result } from "@aos/common";
import type { Branch } from "@aos/meta-ads-connector";

import type { Asset } from "../../domain/entities/Asset.js";
import type { AssetCollection } from "../../domain/entities/AssetCollection.js";
import type { AssetError } from "../../domain/errors/AssetError.js";
import type { AssetType } from "../../domain/value-objects/AssetType.js";
import type { GetAsset } from "../use-cases/GetAsset.js";
import type { GetAssetsByBranch } from "../use-cases/GetAssetsByBranch.js";
import type { GetAssetsByType } from "../use-cases/GetAssetsByType.js";
import type { GetAssetsByUnit } from "../use-cases/GetAssetsByUnit.js";
import type { GetBrandAssets } from "../use-cases/GetBrandAssets.js";

/** Facade over the asset-querying use cases — mirrors `@aos/lead-store`'s `ConversationService` aggregation pattern. */
export class AssetQueryService {
  constructor(
    private readonly getAsset: GetAsset,
    private readonly getAssetsByUnit: GetAssetsByUnit,
    private readonly getAssetsByBranch: GetAssetsByBranch,
    private readonly getAssetsByType: GetAssetsByType,
    private readonly getBrandAssets: GetBrandAssets,
  ) {}

  async byId(id: string): Promise<Result<Asset, AssetError>> {
    return this.getAsset.execute(id);
  }

  async byUnit(unitId: string): Promise<Result<AssetCollection, AssetError>> {
    return this.getAssetsByUnit.execute({ unitId });
  }

  async byBranch(branch: Branch): Promise<Result<AssetCollection, AssetError>> {
    return this.getAssetsByBranch.execute({ branch });
  }

  async byType(type: AssetType): Promise<Result<AssetCollection, AssetError>> {
    return this.getAssetsByType.execute({ type });
  }

  async brandAssets(): Promise<Result<AssetCollection, AssetError>> {
    return this.getBrandAssets.execute();
  }
}

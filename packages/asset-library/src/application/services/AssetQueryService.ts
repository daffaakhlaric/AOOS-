import type { Result } from "@aos/common";
import type { Branch } from "@aos/meta-ads-connector";

import type { AssetPage, AssetStats } from "../../contracts/IAssetRepository.js";
import type { Asset } from "../../domain/entities/Asset.js";
import type { AssetCollection } from "../../domain/entities/AssetCollection.js";
import type { AssetError } from "../../domain/errors/AssetError.js";
import type { AssetType } from "../../domain/value-objects/AssetType.js";
import type { GetAsset } from "../use-cases/GetAsset.js";
import type { GetAssetsByBranch } from "../use-cases/GetAssetsByBranch.js";
import type { GetAssetsByType } from "../use-cases/GetAssetsByType.js";
import type { GetAssetsByUnit } from "../use-cases/GetAssetsByUnit.js";
import type { GetAssetStats, GetAssetStatsInput } from "../use-cases/GetAssetStats.js";
import type { GetBrandAssets } from "../use-cases/GetBrandAssets.js";
import type { ListAssets, ListAssetsInput } from "../use-cases/ListAssets.js";

/** Facade over the asset-querying use cases — mirrors `@aos/lead-store`'s `ConversationService` aggregation pattern. */
export class AssetQueryService {
  constructor(
    private readonly getAsset: GetAsset,
    private readonly getAssetsByUnit: GetAssetsByUnit,
    private readonly getAssetsByBranch: GetAssetsByBranch,
    private readonly getAssetsByType: GetAssetsByType,
    private readonly getBrandAssets: GetBrandAssets,
    private readonly listAssetsUseCase: ListAssets,
    private readonly getAssetStats: GetAssetStats,
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

  /** AAOS-SCRAPER-ASSET-LIBRARY — paginated multi-filter listing for the Asset Library grid. */
  async listAssets(input: ListAssetsInput): Promise<Result<AssetPage, AssetError>> {
    return this.listAssetsUseCase.execute(input);
  }

  /** AAOS-SCRAPER-ASSET-LIBRARY — aggregate counts for the Asset Library KPI strip. */
  async stats(input: GetAssetStatsInput): Promise<Result<AssetStats, AssetError>> {
    return this.getAssetStats.execute(input);
  }
}

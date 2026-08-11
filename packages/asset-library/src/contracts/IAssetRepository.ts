import type { Result } from "@aos/common";
import type { Branch } from "@aos/meta-ads-connector";

import type { Asset } from "../domain/entities/Asset.js";
import type { AssetError } from "../domain/errors/AssetError.js";
import type { AssetId } from "../domain/value-objects/AssetId.js";
import type { AssetStatus } from "../domain/value-objects/AssetStatus.js";
import type { AssetType } from "../domain/value-objects/AssetType.js";

/** Repository Pattern port over the `assets` metadata table (Supabase Postgrest), separate from `IAssetStorage`'s raw file bytes. */
export interface IAssetRepository {
  findById(id: AssetId): Promise<Result<Asset | undefined, AssetError>>;
  insert(asset: Asset): Promise<Result<Asset, AssetError>>;
  update(asset: Asset): Promise<Result<Asset, AssetError>>;
  findByUnitId(unitId: string, status?: AssetStatus): Promise<Result<readonly Asset[], AssetError>>;
  findByBranch(branch: Branch): Promise<Result<readonly Asset[], AssetError>>;
  findByType(type: AssetType, status?: AssetStatus): Promise<Result<readonly Asset[], AssetError>>;
}

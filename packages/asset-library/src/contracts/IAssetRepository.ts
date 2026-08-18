import type { Result } from "@aos/common";
import type { Branch } from "@aos/meta-ads-connector";

import type { Asset } from "../domain/entities/Asset.js";
import type { AssetError } from "../domain/errors/AssetError.js";
import type { AssetId } from "../domain/value-objects/AssetId.js";
import type { AssetStatus } from "../domain/value-objects/AssetStatus.js";
import type { AssetType } from "../domain/value-objects/AssetType.js";

/**
 * Filter for the paginated, multi-criteria `listAssets` query backing the dashboard's Asset
 * Library page (AAOS-SCRAPER-ASSET-LIBRARY). Every field is optional and AND-combined; omitting
 * all of them lists the tenant's newest assets.
 */
export interface AssetListFilter {
  readonly tenantId: string;
  readonly type?: AssetType;
  readonly status?: AssetStatus;
  readonly branch?: Branch;
  readonly unitId?: string;
  /** Free-text substring match (case-insensitive) against `file_name` — the toolbar's "Cari asset…" box. */
  readonly search?: string;
  /** 1-based page number. */
  readonly page: number;
  readonly limit: number;
  /** `newest` (default) / `oldest` order by `created_at`. */
  readonly sort?: "newest" | "oldest";
}

export interface AssetPage {
  readonly assets: readonly Asset[];
  /** Total rows matching the filter, ignoring pagination. */
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

/**
 * Aggregate counts for the Asset Library page's KPI strip. `byType` always contains an entry for
 * every real `AssetType` member (zero when none exist), so the UI never has to guess whether a
 * missing key means "zero" or "unknown".
 */
export interface AssetStats {
  readonly totalAssets: number;
  readonly byType: Readonly<Record<AssetType, number>>;
  readonly byBranch: Readonly<Record<string, number>>;
  readonly byStatus: Readonly<Record<AssetStatus, number>>;
  readonly totalSizeBytes: number;
}

/** Repository Pattern port over the `assets` metadata table (Supabase Postgrest), separate from `IAssetStorage`'s raw file bytes. */
export interface IAssetRepository {
  findById(id: AssetId): Promise<Result<Asset | undefined, AssetError>>;
  insert(asset: Asset): Promise<Result<Asset, AssetError>>;
  update(asset: Asset): Promise<Result<Asset, AssetError>>;
  findByUnitId(unitId: string, status?: AssetStatus): Promise<Result<readonly Asset[], AssetError>>;
  findByBranch(branch: Branch): Promise<Result<readonly Asset[], AssetError>>;
  findByType(type: AssetType, status?: AssetStatus): Promise<Result<readonly Asset[], AssetError>>;
  /** AAOS-SCRAPER-ASSET-LIBRARY — paginated multi-filter listing (see `AssetListFilter`). */
  listAssets(filter: AssetListFilter): Promise<Result<AssetPage, AssetError>>;
  /** AAOS-SCRAPER-ASSET-LIBRARY — tenant-scoped aggregate counts (see `AssetStats`). */
  getStats(tenantId: string): Promise<Result<AssetStats, AssetError>>;
}

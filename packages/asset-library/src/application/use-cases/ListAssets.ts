import { type Result } from "@aos/common";

import type {
  AssetListFilter,
  AssetPage,
  IAssetRepository,
} from "../../contracts/IAssetRepository.js";
import type { AssetError } from "../../domain/errors/AssetError.js";

/** Default page size — matches the Asset Library grid's `?limit=48` (spec's own query example). */
const DEFAULT_LIMIT = 48;

export interface ListAssetsInput {
  readonly tenantId: string;
  readonly type?: AssetListFilter["type"];
  readonly status?: AssetListFilter["status"];
  readonly branch?: AssetListFilter["branch"];
  readonly unitId?: string;
  readonly search?: string;
  /** AAOS-CREATIVE-REVIEW — see `AssetListFilter.model` (case-insensitive `unit_model` match). */
  readonly model?: string;
  /** CREATIVE HUB — see `AssetListFilter.source`'s doc for the real, honest classification rule. */
  readonly source?: AssetListFilter["source"];
  readonly page?: number;
  readonly limit?: number;
  readonly sort?: "newest" | "oldest";
}

/**
 * Paginated, multi-filter asset listing (AAOS-SCRAPER-ASSET-LIBRARY) — the read side of the
 * dashboard's Asset Library grid. Deliberately returns the repository's `AssetPage` (rows + total +
 * page + limit) rather than an `AssetCollection` like `GetAssetsByType`/`GetAssetsByBranch`:
 * `AssetCollection` has no place to carry the unpaginated total the grid's tab counts need, and
 * re-sorting a already-server-sorted page in memory would be redundant.
 */
export class ListAssets {
  constructor(private readonly repository: IAssetRepository) {}

  async execute(input: ListAssetsInput): Promise<Result<AssetPage, AssetError>> {
    return this.repository.listAssets({
      tenantId: input.tenantId,
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.branch !== undefined ? { branch: input.branch } : {}),
      ...(input.unitId !== undefined ? { unitId: input.unitId } : {}),
      ...(input.search !== undefined ? { search: input.search } : {}),
      ...(input.model !== undefined ? { model: input.model } : {}),
      ...(input.source !== undefined ? { source: input.source } : {}),
      page: input.page ?? 1,
      limit: input.limit ?? DEFAULT_LIMIT,
      sort: input.sort ?? "newest",
    });
  }
}

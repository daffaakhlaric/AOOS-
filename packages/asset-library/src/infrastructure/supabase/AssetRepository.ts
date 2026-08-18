import { err, ok, type Result } from "@aos/common";
import type { Branch } from "@aos/meta-ads-connector";

import type {
  AssetListFilter,
  AssetPage,
  AssetStats,
  IAssetRepository,
} from "../../contracts/IAssetRepository.js";
import type { Asset } from "../../domain/entities/Asset.js";
import type { AssetError } from "../../domain/errors/AssetError.js";
import { StorageError } from "../../domain/errors/StorageError.js";
import type { AssetId } from "../../domain/value-objects/AssetId.js";
import { AssetStatus } from "../../domain/value-objects/AssetStatus.js";
import { AssetType } from "../../domain/value-objects/AssetType.js";
import { AssetMapper, type AssetRow } from "../mappers/AssetMapper.js";

import type { SupabaseClientLike, SupabaseFilterBuilderLike } from "./SupabaseTypes.js";

const TABLE = "assets";
/**
 * Hard ceiling on `listAssets`'s page size — a runaway `?limit=100000` would otherwise pull the
 * whole table into memory to satisfy one grid render. The Asset Library page asks for 48.
 */
const MAX_PAGE_LIMIT = 200;
/**
 * `getStats` reads real rows and aggregates them in-process rather than issuing one
 * `count`-per-type/branch round trip (Postgrest has no `GROUP BY` in its REST surface without a
 * database view or RPC, neither of which exists for `assets` today). This cap keeps that honest:
 * beyond it the returned counts would be a partial sample, so the query is bounded and the count
 * fields describe exactly what was scanned. DSS Motor's real library is in the hundreds of rows
 * (~412 in the spec's own KPI example), well inside this bound.
 */
const STATS_SCAN_LIMIT = 5000;

/** Supabase (Postgrest) implementation of `IAssetRepository`, backing the `assets` metadata table. Mirrors `@aos/lead-store`'s `LeadRepository`. */
export class AssetRepository implements IAssetRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async findById(id: AssetId): Promise<Result<Asset | undefined, AssetError>> {
    const { data, error } = await this.client
      .from<AssetRow>(TABLE)
      .select("*")
      .eq("id", id.toString())
      .maybeSingle();
    if (error !== null) {
      return err(new StorageError(`AssetRepository.findById failed: ${error.message}`));
    }
    if (data === null) {
      return ok(undefined);
    }
    return mapRow(data);
  }

  async insert(asset: Asset): Promise<Result<Asset, AssetError>> {
    const { data, error } = await this.client
      .from<AssetRow>(TABLE)
      .insert(AssetMapper.toRow(asset))
      .select("*")
      .single();
    if (error !== null) {
      return err(new StorageError(`AssetRepository.insert failed: ${error.message}`));
    }
    if (data === null) {
      return err(new StorageError("AssetRepository.insert failed: no row returned"));
    }
    return mapRow(data);
  }

  async update(asset: Asset): Promise<Result<Asset, AssetError>> {
    const { data, error } = await this.client
      .from<AssetRow>(TABLE)
      .update(AssetMapper.toRow(asset))
      .eq("id", asset.id.toString())
      .select("*")
      .single();
    if (error !== null) {
      return err(new StorageError(`AssetRepository.update failed: ${error.message}`));
    }
    if (data === null) {
      return err(new StorageError("AssetRepository.update failed: no row returned"));
    }
    return mapRow(data);
  }

  async findByUnitId(
    unitId: string,
    status?: AssetStatus,
  ): Promise<Result<readonly Asset[], AssetError>> {
    let query = this.client.from<AssetRow>(TABLE).select("*").eq("unit_id", unitId);
    if (status !== undefined) {
      query = query.eq("status", status);
    }
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error !== null) {
      return err(new StorageError(`AssetRepository.findByUnitId failed: ${error.message}`));
    }
    return mapRows(data ?? []);
  }

  async findByBranch(branch: Branch): Promise<Result<readonly Asset[], AssetError>> {
    const { data, error } = await this.client
      .from<AssetRow>(TABLE)
      .select("*")
      .eq("branch", branch)
      .order("created_at", { ascending: false });
    if (error !== null) {
      return err(new StorageError(`AssetRepository.findByBranch failed: ${error.message}`));
    }
    return mapRows(data ?? []);
  }

  async findByType(
    type: AssetType,
    status?: AssetStatus,
  ): Promise<Result<readonly Asset[], AssetError>> {
    let query = this.client.from<AssetRow>(TABLE).select("*").eq("type", type);
    if (status !== undefined) {
      query = query.eq("status", status);
    }
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error !== null) {
      return err(new StorageError(`AssetRepository.findByType failed: ${error.message}`));
    }
    return mapRows(data ?? []);
  }

  /**
   * Paginated, multi-filter listing (AAOS-SCRAPER-ASSET-LIBRARY). Uses Postgrest's
   * `select("*", { count: "exact" })` + `range(from, to)` idiom so ONE round trip returns both the
   * page's rows and the unpaginated total the grid's "Semua (412)" tab needs. Always
   * `tenant_id`-scoped (Constitution §6.7) — unlike the older `findByType`/`findByBranch` finders,
   * which predate this and filter on their one column only.
   */
  async listAssets(filter: AssetListFilter): Promise<Result<AssetPage, AssetError>> {
    const page = Math.max(1, Math.trunc(filter.page));
    const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, Math.trunc(filter.limit)));
    const from = (page - 1) * limit;

    let query: SupabaseFilterBuilderLike<AssetRow> = this.client
      .from<AssetRow>(TABLE)
      .select("*", { count: "exact" })
      .eq("tenant_id", filter.tenantId);
    if (filter.type !== undefined) {
      query = query.eq("type", filter.type);
    }
    if (filter.status !== undefined) {
      query = query.eq("status", filter.status);
    }
    if (filter.branch !== undefined) {
      query = query.eq("branch", filter.branch);
    }
    if (filter.unitId !== undefined) {
      query = query.eq("unit_id", filter.unitId);
    }
    if (filter.search !== undefined && filter.search.trim().length > 0) {
      query = query.ilike("file_name", `%${filter.search.trim()}%`);
    }
    // AAOS-CREATIVE-REVIEW: `unit_model` is a real, scraper-populated column (see `AssetListFilter.model`).
    if (filter.model !== undefined && filter.model.trim().length > 0) {
      query = query.ilike("unit_model", `%${filter.model.trim()}%`);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: filter.sort === "oldest" })
      .range(from, from + limit - 1);
    if (error !== null) {
      return err(new StorageError(`AssetRepository.listAssets failed: ${error.message}`));
    }
    const rows = data ?? [];
    const mapped = mapRows(rows);
    if (!mapped.ok) {
      return mapped;
    }
    return ok({
      assets: mapped.value,
      // `count` is absent only if Postgrest ignored the `count` option; falling back to the page's
      // own length is the honest floor, never a fabricated larger number.
      total: count ?? rows.length,
      page,
      limit,
    });
  }

  /** Tenant-scoped aggregate counts for the Asset Library KPI strip — see `STATS_SCAN_LIMIT`'s doc for the in-process aggregation rationale. */
  async getStats(tenantId: string): Promise<Result<AssetStats, AssetError>> {
    const { data, error } = await this.client
      .from<AssetRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(STATS_SCAN_LIMIT);
    if (error !== null) {
      return err(new StorageError(`AssetRepository.getStats failed: ${error.message}`));
    }

    const byType: Record<AssetType, number> = {
      [AssetType.UNIT_PHOTO]: 0,
      [AssetType.BRAND]: 0,
      [AssetType.TESTIMONIAL]: 0,
      [AssetType.AI_VIDEO]: 0,
      [AssetType.AI_IMAGE]: 0,
      [AssetType.OVERLAY]: 0,
    };
    const byStatus: Record<AssetStatus, number> = {
      [AssetStatus.ACTIVE]: 0,
      [AssetStatus.ARCHIVED]: 0,
      [AssetStatus.PENDING]: 0,
    };
    const byBranch: Record<string, number> = {};
    let totalSizeBytes = 0;

    for (const row of data ?? []) {
      // Unknown enum members are counted into the totals but never invent a new bucket — the
      // mapper would reject such a row anyway, so this only guards a hand-edited DB value.
      if (row.type in byType) {
        byType[row.type as AssetType] += 1;
      }
      if (row.status in byStatus) {
        byStatus[row.status as AssetStatus] += 1;
      }
      if (row.branch !== null) {
        byBranch[row.branch] = (byBranch[row.branch] ?? 0) + 1;
      }
      totalSizeBytes += row.file_size;
    }

    return ok({
      totalAssets: (data ?? []).length,
      byType,
      byBranch,
      byStatus,
      totalSizeBytes,
    });
  }
}

function mapRow(row: AssetRow): Result<Asset, AssetError> {
  const result = AssetMapper.toDomain(row);
  if (!result.ok) {
    return err(new StorageError(`AssetRepository: row mapping failed: ${result.error.message}`));
  }
  return ok(result.value);
}

function mapRows(rows: readonly AssetRow[]): Result<readonly Asset[], AssetError> {
  const assets: Asset[] = [];
  for (const row of rows) {
    const result = mapRow(row);
    if (!result.ok) {
      return result;
    }
    assets.push(result.value);
  }
  return ok(assets);
}

import { err, ok, type Result } from "@aos/common";

import type {
  IScrapedUnitRepository,
  ScrapedUnitListFilter,
  ScrapedUnitPage,
  ScrapedUnitStats,
} from "../../contracts/IScrapedUnitRepository.js";
import type { ScrapedUnit } from "../../domain/entities/ScrapedUnit.js";
import { ScrapeError } from "../../domain/errors/ScrapeError.js";
import { ScrapedUnitMapper, type ScrapedUnitRow } from "../mappers/ScrapedUnitMapper.js";

import type { SupabaseClientLike, SupabaseFilterBuilderLike } from "./SupabaseTypes.js";

const TABLE = "scraped_units";
/** Matches the `(tenant_id, identity_key)` UNIQUE constraint in `001_scraped_units.sql`. */
const CONFLICT_TARGET = "tenant_id,identity_key";
const MAX_PAGE_LIMIT = 200;
/**
 * `getStats` aggregates real rows in-process — Postgrest exposes no `GROUP BY` without a database
 * view/RPC, neither of which exists for `scraped_units`. DSS Motor's real listing is ~50 units, so
 * this bound is never approached; it exists so the query can never become unbounded.
 */
const STATS_SCAN_LIMIT = 5000;

/**
 * Supabase (Postgrest) implementation of `IScrapedUnitRepository`, backing the `scraped_units`
 * table. Mirrors `@aos/asset-library`'s `AssetRepository` (same `Result`-returning discipline —
 * every expected failure becomes an `err(ScrapeError)`, never a throw — and the same
 * mapper-owns-the-column-shape split).
 */
export class ScrapedUnitRepository implements IScrapedUnitRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  /**
   * Upserts the whole batch in one round trip. Idempotent by design: re-running a scrape overwrites
   * each unit's row in place (fresh price/km/availability/`scraped_at`) rather than accumulating
   * duplicates — which is exactly what "Scrape Semua Ulang" needs, since `RunFullScrape` re-parses
   * the entire listing every run even though it only re-downloads NEW units' photos.
   */
  async upsertMany(
    units: readonly ScrapedUnit[],
    tenantId: string,
  ): Promise<Result<number, ScrapeError>> {
    if (units.length === 0) {
      return ok(0);
    }
    const rows = units.map((unit) => ScrapedUnitMapper.toRow(unit, tenantId));
    const { error } = await this.client
      .from<ScrapedUnitRow>(TABLE)
      .upsert(rows, { onConflict: CONFLICT_TARGET })
      .select("identity_key");
    if (error !== null) {
      return err(new ScrapeError(`ScrapedUnitRepository.upsertMany failed: ${error.message}`));
    }
    return ok(rows.length);
  }

  async findByIdentityKey(
    identityKey: string,
    tenantId: string,
  ): Promise<Result<ScrapedUnit | undefined, ScrapeError>> {
    const { data, error } = await this.client
      .from<ScrapedUnitRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("identity_key", identityKey)
      .maybeSingle();
    if (error !== null) {
      return err(
        new ScrapeError(`ScrapedUnitRepository.findByIdentityKey failed: ${error.message}`),
      );
    }
    if (data === null) {
      return ok(undefined);
    }
    return mapRow(data);
  }

  async list(filter: ScrapedUnitListFilter): Promise<Result<ScrapedUnitPage, ScrapeError>> {
    const page = Math.max(1, Math.trunc(filter.page));
    const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, Math.trunc(filter.limit)));
    const from = (page - 1) * limit;

    let query: SupabaseFilterBuilderLike<ScrapedUnitRow> = this.client
      .from<ScrapedUnitRow>(TABLE)
      .select("*", { count: "exact" })
      .eq("tenant_id", filter.tenantId);
    if (filter.branch !== undefined) {
      query = query.eq("branch", filter.branch);
    }
    if (filter.available !== undefined) {
      query = query.eq("available", filter.available);
    }
    if (filter.search !== undefined && filter.search.trim().length > 0) {
      query = query.ilike("model", `%${filter.search.trim()}%`);
    }

    const { data, error, count } = await query
      .order("scraped_at", { ascending: false })
      .range(from, from + limit - 1);
    if (error !== null) {
      return err(new ScrapeError(`ScrapedUnitRepository.list failed: ${error.message}`));
    }
    const rows = data ?? [];
    const mapped = mapRows(rows);
    if (!mapped.ok) {
      return mapped;
    }
    return ok({ units: mapped.value, total: count ?? rows.length, page, limit });
  }

  async getStats(tenantId: string): Promise<Result<ScrapedUnitStats, ScrapeError>> {
    const { data, error } = await this.client
      .from<ScrapedUnitRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("scraped_at", { ascending: false })
      .limit(STATS_SCAN_LIMIT);
    if (error !== null) {
      return err(new ScrapeError(`ScrapedUnitRepository.getStats failed: ${error.message}`));
    }

    const rows = data ?? [];
    const byBranch: Record<string, number> = {};
    let availableUnits = 0;
    let totalPhotos = 0;
    let lastScrapedAt: string | undefined;

    for (const row of rows) {
      byBranch[row.branch] = (byBranch[row.branch] ?? 0) + 1;
      if (row.available) {
        availableUnits += 1;
      }
      totalPhotos += row.photos.length;
      if (lastScrapedAt === undefined || row.scraped_at > lastScrapedAt) {
        lastScrapedAt = row.scraped_at;
      }
    }

    return ok({
      totalUnits: rows.length,
      availableUnits,
      totalPhotos,
      byBranch,
      ...(lastScrapedAt !== undefined ? { lastScrapedAt } : {}),
    });
  }
}

function mapRow(row: ScrapedUnitRow): Result<ScrapedUnit, ScrapeError> {
  const result = ScrapedUnitMapper.toDomain(row);
  if (!result.ok) {
    return err(
      new ScrapeError(`ScrapedUnitRepository: row mapping failed: ${result.error.message}`),
    );
  }
  return ok(result.value);
}

function mapRows(rows: readonly ScrapedUnitRow[]): Result<readonly ScrapedUnit[], ScrapeError> {
  const units: ScrapedUnit[] = [];
  for (const row of rows) {
    const result = mapRow(row);
    if (!result.ok) {
      return result;
    }
    units.push(result.value);
  }
  return ok(units);
}

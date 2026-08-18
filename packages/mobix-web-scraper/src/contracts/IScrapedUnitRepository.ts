import type { Result } from "@aos/common";
import type { Branch } from "@aos/meta-ads-connector";

import type { ScrapedUnit } from "../domain/entities/ScrapedUnit.js";
import type { ScrapeError } from "../domain/errors/ScrapeError.js";

/** Filter for the paginated stock listing behind `GET /api/v1/scraper/stock`. */
export interface ScrapedUnitListFilter {
  readonly tenantId: string;
  readonly branch?: Branch;
  readonly available?: boolean;
  /** Case-insensitive substring match against `model`. */
  readonly search?: string;
  /** 1-based page number. */
  readonly page: number;
  readonly limit: number;
}

export interface ScrapedUnitPage {
  readonly units: readonly ScrapedUnit[];
  /** Total rows matching the filter, ignoring pagination. */
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

/** Aggregate stock counts behind `GET /api/v1/scraper/status`. */
export interface ScrapedUnitStats {
  readonly totalUnits: number;
  readonly availableUnits: number;
  /** Sum of `photos.length` across every persisted unit — the SOURCE photo URLs found on the listing, not the count of photos successfully stored in GCS (those are `assets` rows). */
  readonly totalPhotos: number;
  readonly byBranch: Readonly<Record<string, number>>;
  /** ISO timestamp of the most recent `scraped_at` across all units, or `undefined` when nothing has ever been scraped. */
  readonly lastScrapedAt?: string;
}

/**
 * Repository Pattern port over the `scraped_units` metadata table (AAOS-SCRAPER-ASSET-LIBRARY).
 *
 * Before this, `MobixScraperService` held scraped units in a process-local `lastSession` field only
 * — nothing about a unit's price/km/color/transmission/availability survived a restart, and the
 * dashboard had no way to list real stock. This port is that missing durability, mirroring
 * `@aos/asset-library`'s `IAssetRepository`. Deliberately Postgres-backed rather than the original
 * spec's GCS `index.json`/`metadata.json` files: this is queryable, tenant-scoped entity data that
 * belongs next to every other persisted entity in this codebase.
 */
export interface IScrapedUnitRepository {
  /** Idempotent write of a whole scrape session's units, keyed on `(tenant_id, identity_key)`. */
  upsertMany(units: readonly ScrapedUnit[], tenantId: string): Promise<Result<number, ScrapeError>>;
  findByIdentityKey(
    identityKey: string,
    tenantId: string,
  ): Promise<Result<ScrapedUnit | undefined, ScrapeError>>;
  list(filter: ScrapedUnitListFilter): Promise<Result<ScrapedUnitPage, ScrapeError>>;
  getStats(tenantId: string): Promise<Result<ScrapedUnitStats, ScrapeError>>;
}

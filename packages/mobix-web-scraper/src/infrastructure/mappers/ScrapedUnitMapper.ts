import { err, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { Branch } from "@aos/meta-ads-connector";

import { ScrapedUnit, type Transmission } from "../../domain/entities/ScrapedUnit.js";
import { ScrapedKilometer } from "../../domain/value-objects/ScrapedKilometer.js";
import { ScrapedPrice } from "../../domain/value-objects/ScrapedPrice.js";
import { ScrapeTimestamp } from "../../domain/value-objects/ScrapeTimestamp.js";
import { UnitUrl } from "../../domain/value-objects/UnitUrl.js";

/**
 * The `scraped_units` table row shape (Constitution §6.7: `snake_case`, tenant-scoped) — see
 * `supabase/migrations/001_scraped_units.sql`, which mirrors this interface column-for-column.
 *
 * `identity_key` is `ScrapedUnit.identityKey` (the detail-page URL slug), the stable per-unit key
 * `DetectInventoryChanges` already diffs on and `@aos/asset-library`'s `assets.unit_id` already
 * stores — so a unit's persisted metadata and its persisted photos join on the same value with no
 * new identifier invented here.
 */
export interface ScrapedUnitRow {
  readonly identity_key: string;
  readonly tenant_id: string;
  readonly url: string;
  readonly brand: string;
  readonly model: string;
  readonly year: number;
  readonly transmission: string;
  readonly color: string;
  readonly kilometer: number;
  readonly price_idr: number;
  readonly branch: string;
  readonly photos: readonly string[];
  readonly available: boolean;
  readonly scraped_at: string;
}

const KNOWN_BRANCHES = new Set<string>(Object.values(Branch));

/** Maps between the domain `ScrapedUnit` entity and its Supabase `scraped_units` row — the sole place that knows the DB column shape (mirrors `@aos/asset-library`'s `AssetMapper`). */
export class ScrapedUnitMapper {
  static toDomain(row: ScrapedUnitRow): Result<ScrapedUnit, ValidationError> {
    const urlResult = UnitUrl.create(row.url);
    if (!urlResult.ok) {
      return err(urlResult.error);
    }
    if (row.transmission !== "AT" && row.transmission !== "MT") {
      return err(
        new ValidationError(`ScrapedUnitMapper: unknown transmission in row: ${row.transmission}`),
      );
    }
    const transmission: Transmission = row.transmission;
    if (!KNOWN_BRANCHES.has(row.branch)) {
      return err(new ValidationError(`ScrapedUnitMapper: unknown branch in row: ${row.branch}`));
    }
    const kilometerResult = ScrapedKilometer.create(row.kilometer);
    if (!kilometerResult.ok) {
      return err(kilometerResult.error);
    }
    const priceResult = ScrapedPrice.create(row.price_idr);
    if (!priceResult.ok) {
      return err(priceResult.error);
    }
    const scrapedAtDate = new Date(row.scraped_at);
    const scrapedAtResult = ScrapeTimestamp.create(scrapedAtDate);
    if (!scrapedAtResult.ok) {
      return err(scrapedAtResult.error);
    }

    return ScrapedUnit.create({
      url: urlResult.value,
      model: row.model,
      brand: row.brand,
      year: row.year,
      transmission,
      color: row.color,
      kilometer: kilometerResult.value,
      price: priceResult.value,
      branch: row.branch as Branch,
      photos: row.photos,
      available: row.available,
      scrapedAt: scrapedAtResult.value,
    });
  }

  static toRow(unit: ScrapedUnit, tenantId: string): ScrapedUnitRow {
    return {
      identity_key: unit.identityKey,
      tenant_id: tenantId,
      url: unit.url.href,
      brand: unit.brand,
      model: unit.model,
      year: unit.year,
      transmission: unit.transmission,
      color: unit.color,
      kilometer: unit.kilometer.km,
      price_idr: unit.price.idr,
      branch: unit.branch,
      photos: [...unit.photos],
      available: unit.available,
      scraped_at: unit.scrapedAt.toISOString(),
    };
  }
}

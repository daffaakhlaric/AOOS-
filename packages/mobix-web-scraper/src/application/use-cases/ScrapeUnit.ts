import { err, ok, type Result } from "@aos/common";

import type { IScrapedUnitRepository } from "../../contracts/IScrapedUnitRepository.js";
import type { ScrapedUnit } from "../../domain/entities/ScrapedUnit.js";
import type { ParseError } from "../../domain/errors/ParseError.js";
import { ScrapeError } from "../../domain/errors/ScrapeError.js";
import { UnitUrl } from "../../domain/value-objects/UnitUrl.js";

import type { DownloadAndStorePhotos, PhotoBatchResult } from "./DownloadAndStorePhotos.js";
import type { ScrapeInventory } from "./ScrapeInventory.js";

export interface ScrapeUnitResult {
  readonly unit: ScrapedUnit;
  readonly photoResult?: PhotoBatchResult;
  readonly persisted: boolean;
}

/**
 * Re-scrapes ONE unit ("🔄 Scrape ulang unit ini" on the Scraper page's unit-detail modal) —
 * AAOS-SCRAPER-ASSET-LIBRARY.
 *
 * How it works: the unit's listing-level fields (price, km, color, branch, availability) come from
 * mobixbydss.id's real listing API via `ScrapeInventory`/`IInventoryScraper`, selecting the unit
 * whose `identityKey` (URL slug) matches `unitUrl` — the listing endpoint is the authoritative
 * source of those fields. Its PHOTOS then come from the unit's own real detail endpoint
 * (`POST /api/get-detail-produk`) via the `IUnitDetailFetcher` that `DownloadAndStorePhotos` owns, so
 * a manual single-unit re-scrape ingests the unit's complete `galeri` (~11 photos), not just the one
 * thumbnail the listing carries.
 *
 * This supersedes an earlier limitation: when this package still scraped HTML there was no
 * detail-page parser, so a re-scrape could only ever recover listing-level data. The real API's
 * detail endpoint removed that constraint.
 *
 * Unlike `RunFullScrape`, this ALWAYS re-ingests the unit's photos rather than only doing so for
 * newly-detected units — that is the whole point of an operator explicitly asking to re-scrape one
 * unit. The photo set that gets persisted is the same full gallery that was downloaded.
 */
export class ScrapeUnit {
  constructor(
    private readonly scrapeInventory: ScrapeInventory,
    private readonly downloadAndStorePhotos?: DownloadAndStorePhotos,
    private readonly scrapedUnitRepository?: IScrapedUnitRepository,
    private readonly tenantId: string = "dss-motor",
  ) {}

  async execute(
    unitUrl: string,
    correlationId?: string,
  ): Promise<Result<ScrapeUnitResult, ScrapeError | ParseError>> {
    const urlResult = UnitUrl.create(unitUrl);
    if (!urlResult.ok) {
      return err(new ScrapeError(`ScrapeUnit: invalid unit URL: ${urlResult.error.message}`));
    }
    const wantedSlug = urlResult.value.slug;
    if (wantedSlug.length === 0) {
      return err(new ScrapeError(`ScrapeUnit: unit URL has no slug segment: ${unitUrl}`));
    }

    const sessionResult = await this.scrapeInventory.execute();
    if (!sessionResult.ok) {
      return sessionResult;
    }

    const listingUnit = sessionResult.value.units.find(
      (candidate) => candidate.identityKey === wantedSlug,
    );
    if (listingUnit === undefined) {
      return err(
        new ScrapeError(
          `ScrapeUnit: no unit matching "${wantedSlug}" found in the current mobixbydss.id listing ` +
            `(it may have been sold or delisted)`,
        ),
      );
    }

    let unit = listingUnit;
    let photoResult: PhotoBatchResult | undefined;
    if (this.downloadAndStorePhotos) {
      const batch = await this.downloadAndStorePhotos.execute(listingUnit, correlationId);
      /* v8 ignore next 3 -- DownloadAndStorePhotos.execute's Result<PhotoBatchResult, never> never resolves to the error branch. */
      if (!batch.ok) {
        throw new Error("unreachable: DownloadAndStorePhotos.execute never returns an error");
      }
      photoResult = batch.value;
      // Carry the full gallery that was actually downloaded onto the returned/persisted unit, so
      // `scraped_units.photos` matches what really landed in `@aos/asset-library`.
      if (photoResult.resolvedPhotos.length > 0) {
        unit = listingUnit.withPhotos(photoResult.resolvedPhotos);
      }
    }

    let persisted = false;
    if (this.scrapedUnitRepository) {
      const upserted = await this.scrapedUnitRepository.upsertMany([unit], this.tenantId);
      // Same discipline as `RunFullScrape`: a persistence failure is reported (via `persisted:
      // false`) rather than discarding a real, successful re-scrape.
      persisted = upserted.ok;
    }

    return ok({ unit, ...(photoResult !== undefined ? { photoResult } : {}), persisted });
  }
}

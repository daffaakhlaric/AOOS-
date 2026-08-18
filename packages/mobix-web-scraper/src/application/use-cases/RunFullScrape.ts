import { ok, type Result } from "@aos/common";

import type { IScrapedUnitRepository } from "../../contracts/IScrapedUnitRepository.js";
import type { ScrapeSession } from "../../domain/entities/ScrapeSession.js";
import type { ParseError } from "../../domain/errors/ParseError.js";
import type { ScrapeError } from "../../domain/errors/ScrapeError.js";

import type { DetectInventoryChanges, InventoryDiff } from "./DetectInventoryChanges.js";
import type { DownloadAndStorePhotos, PhotoBatchResult } from "./DownloadAndStorePhotos.js";
import type { ScrapeInventory } from "./ScrapeInventory.js";

/**
 * Real, observable milestones of one full-scrape run (AAOS-SCRAPER-ASSET-LIBRARY). Every variant
 * corresponds to something that ACTUALLY happened in the pipeline below — there is no synthetic
 * "45%" tick, no fabricated per-photo line. `apps/aaos-api`'s scrape-job service turns these into
 * persisted `scrape_job_logs` rows, which the dashboard's progress modal then streams.
 */
export type ScrapeProgressEvent =
  | { readonly type: "listing_parsed"; readonly totalUnits: number }
  | { readonly type: "diff_computed"; readonly newUnits: number; readonly soldUnits: number }
  | {
      readonly type: "unit_photos_done";
      readonly identityKey: string;
      readonly model: string;
      readonly current: number;
      readonly total: number;
      readonly succeeded: number;
      readonly failed: number;
    }
  | { readonly type: "units_persisted"; readonly count: number }
  | { readonly type: "persist_failed"; readonly reason: string }
  /**
   * A real unit's `cabang` had no `@aos/meta-ads-connector` `Branch` member and fell back to
   * `Branch.UMUM` — e.g. the real `"PONDOK BAMBU"` dealer branch, or the internal `"hq3"` code.
   * Surfaced as a WARN log line so this genuine product gap stays visible instead of silent. See
   * `normalizeCabang`.
   */
  | {
      readonly type: "branch_fallback";
      readonly rawCabang: string;
      readonly slug: string;
      readonly fallback: string;
    }
  /**
   * REAL BUG FIX regression signal: mobixbydss.id's own paginated listing can return the SAME unit
   * on more than one page within a single scrape (no stable ordering guarantee across requests). A
   * duplicate `identityKey` used to make the WHOLE `scraped_units` batch upsert fail (Postgres's
   * "ON CONFLICT DO UPDATE command cannot affect row a second time"), silently zeroing out every
   * unit's persisted metadata for that run while photo ingestion kept working — masking the failure
   * entirely. `ScrapedUnitRepository.upsertMany` now deduplicates instead of failing; this event
   * keeps that real, observed data-quality quirk visible rather than silent.
   */
  | { readonly type: "duplicate_unit"; readonly identityKey: string };

export type ScrapeProgressListener = (event: ScrapeProgressEvent) => void;

export interface RunFullScrapeResult {
  readonly session: ScrapeSession;
  readonly diff: InventoryDiff;
  readonly photoResults: ReadonlyArray<PhotoBatchResult>;
  /**
   * How many units were written to `scraped_units`. `undefined` when no `IScrapedUnitRepository`
   * was wired in (persistence skipped, same optional-collaborator style as the photo step).
   */
  readonly persistedUnits?: number;
}

/**
 * The single full-scrape entry point: scrapes the current listing (`ScrapeInventory`), diffs it
 * against the previous session (`DetectInventoryChanges` — reused as-is, publishing
 * `NewUnitDetected`/`UnitSoldOut`), and — when a `DownloadAndStorePhotos` collaborator is wired
 * in (it is optional; omitted when the factory isn't configured with an `@aos/asset-library`
 * `UploadAsset` dependency) — downloads and uploads photos.
 *
 * Design choice: photos are downloaded only for `diff.newUnits`, not every unit in the session.
 * Rationale — `ScrapedUnit.identityKey` already gives `DetectInventoryChanges` a reliable way to
 * tell "already scraped before" from "new this run", so re-downloading/re-uploading photos for
 * units that were already ingested on a prior run would waste bandwidth and create duplicate
 * `@aos/asset-library` rows for the same unit. On the very first scrape (no previous session),
 * `DetectInventoryChanges` treats every unit as new, so the whole session's photos are processed —
 * exactly the "cold start" behavior a fresh deployment needs. This is why the dashboard's
 * "Scrape Semua Ulang" button is worded as "cek unit baru & update listing — foto unit yang sudah
 * ada tidak diunduh ulang": it re-parses the ENTIRE listing (so every unit's price/km/availability
 * is refreshed in `scraped_units`) but only ingests photos for genuinely new units.
 *
 * AAOS-SCRAPER-ASSET-LIBRARY additions:
 * - `scrapedUnitRepository` (optional): when supplied, EVERY unit in the session — not just the new
 *   ones — is upserted into `scraped_units`, which is what makes `getStockList()`/`searchByModel()`
 *   return real, durable data. This is the only writer of that table.
 * - `onProgress` (optional): real milestone callbacks (see `ScrapeProgressEvent`).
 *
 * Partial-failure-tolerant end to end: a photo failure never fails the scrape (see
 * `DownloadAndStorePhotos`'s own docstring), a persistence failure is reported via
 * `persist_failed` and leaves the scrape result intact rather than discarding a successful scrape,
 * and this orchestrator only fails if the scrape or parse itself fails — `DetectInventoryChanges`
 * and the photo step both return `Result<_, never>`.
 */
export class RunFullScrape {
  constructor(
    private readonly scrapeInventory: ScrapeInventory,
    private readonly detectInventoryChanges: DetectInventoryChanges,
    private readonly downloadAndStorePhotos?: DownloadAndStorePhotos,
    private readonly scrapedUnitRepository?: IScrapedUnitRepository,
    private readonly tenantId: string = "dss-motor",
  ) {}

  async execute(
    previousSession: ScrapeSession | undefined,
    correlationId?: string,
    onProgress?: ScrapeProgressListener,
  ): Promise<Result<RunFullScrapeResult, ScrapeError | ParseError>> {
    const sessionResult = await this.scrapeInventory.execute((warning) => {
      onProgress?.({
        type: "branch_fallback",
        rawCabang: warning.rawCabang,
        slug: warning.slug,
        fallback: warning.fallback,
      });
    });
    if (!sessionResult.ok) {
      return sessionResult;
    }
    const session = sessionResult.value;
    onProgress?.({ type: "listing_parsed", totalUnits: session.units.length });

    const diffResult = await this.detectInventoryChanges.execute(previousSession, session);
    /* v8 ignore next 3 -- DetectInventoryChanges.execute's Result<InventoryDiff, never> never resolves to the error branch. */
    if (!diffResult.ok) {
      throw new Error("unreachable: DetectInventoryChanges.execute never returns an error");
    }
    const diff = diffResult.value;
    onProgress?.({
      type: "diff_computed",
      newUnits: diff.newUnits.length,
      soldUnits: diff.soldUnits.length,
    });

    const photoResults: PhotoBatchResult[] = [];
    if (this.downloadAndStorePhotos) {
      let index = 0;
      for (const unit of diff.newUnits) {
        index += 1;
        const batchResult = await this.downloadAndStorePhotos.execute(unit, correlationId);
        /* v8 ignore next 3 -- DownloadAndStorePhotos.execute's Result<PhotoBatchResult, never> never resolves to the error branch. */
        if (!batchResult.ok) {
          throw new Error("unreachable: DownloadAndStorePhotos.execute never returns an error");
        }
        photoResults.push(batchResult.value);
        onProgress?.({
          type: "unit_photos_done",
          identityKey: unit.identityKey,
          model: `${unit.brand} ${unit.model} ${String(unit.year)}`.trim(),
          current: index,
          total: diff.newUnits.length,
          succeeded: batchResult.value.succeeded.length,
          failed: batchResult.value.failed.length,
        });
      }
    }

    let persistedUnits: number | undefined;
    if (this.scrapedUnitRepository) {
      // Persist the FULL galleries that were actually downloaded for the new units, not the single
      // listing thumbnail those units were mapped with — otherwise `scraped_units.photos` would
      // disagree with what's really in `@aos/asset-library`. Units that weren't photo-processed this
      // run (already-known ones) are persisted unchanged, preserving the no-re-download behavior.
      const galleries = new Map(
        photoResults.map((batch) => [batch.unitIdentityKey, batch.resolvedPhotos]),
      );
      const unitsToPersist = session.units.map((unit) => {
        const gallery = galleries.get(unit.identityKey);
        return gallery !== undefined && gallery.length > 0 ? unit.withPhotos(gallery) : unit;
      });
      const persisted = await this.scrapedUnitRepository.upsertMany(
        unitsToPersist,
        this.tenantId,
        (identityKey) => onProgress?.({ type: "duplicate_unit", identityKey }),
      );
      if (persisted.ok) {
        persistedUnits = persisted.value;
        onProgress?.({ type: "units_persisted", count: persisted.value });
      } else {
        // A metadata-persistence failure must not throw away an otherwise-successful scrape (the
        // photos are already in GCS at this point). Reported honestly instead.
        onProgress?.({ type: "persist_failed", reason: persisted.error.message });
      }
    }

    return ok({
      session,
      diff,
      photoResults,
      ...(persistedUnits !== undefined ? { persistedUnits } : {}),
    });
  }
}

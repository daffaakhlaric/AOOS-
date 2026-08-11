import { ok, type Result } from "@aos/common";

import type { ScrapeSession } from "../../domain/entities/ScrapeSession.js";
import type { ParseError } from "../../domain/errors/ParseError.js";
import type { ScrapeError } from "../../domain/errors/ScrapeError.js";

import type { DetectInventoryChanges, InventoryDiff } from "./DetectInventoryChanges.js";
import type { DownloadAndStorePhotos, PhotoBatchResult } from "./DownloadAndStorePhotos.js";
import type { ScrapeInventory } from "./ScrapeInventory.js";

export interface RunFullScrapeResult {
  readonly session: ScrapeSession;
  readonly diff: InventoryDiff;
  readonly photoResults: ReadonlyArray<PhotoBatchResult>;
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
 * exactly the "cold start" behavior a fresh deployment needs.
 *
 * Partial-failure-tolerant end to end: a photo failure never fails the scrape (see
 * `DownloadAndStorePhotos`'s own docstring), and this orchestrator only fails if the scrape or
 * parse itself fails — `DetectInventoryChanges` and the photo step both return `Result<_, never>`.
 */
export class RunFullScrape {
  constructor(
    private readonly scrapeInventory: ScrapeInventory,
    private readonly detectInventoryChanges: DetectInventoryChanges,
    private readonly downloadAndStorePhotos?: DownloadAndStorePhotos,
  ) {}

  async execute(
    previousSession: ScrapeSession | undefined,
    correlationId?: string,
  ): Promise<Result<RunFullScrapeResult, ScrapeError | ParseError>> {
    const sessionResult = await this.scrapeInventory.execute();
    if (!sessionResult.ok) {
      return sessionResult;
    }
    const session = sessionResult.value;

    const diffResult = await this.detectInventoryChanges.execute(previousSession, session);
    /* v8 ignore next 3 -- DetectInventoryChanges.execute's Result<InventoryDiff, never> never resolves to the error branch. */
    if (!diffResult.ok) {
      throw new Error("unreachable: DetectInventoryChanges.execute never returns an error");
    }
    const diff = diffResult.value;

    const photoResults: PhotoBatchResult[] = [];
    if (this.downloadAndStorePhotos) {
      for (const unit of diff.newUnits) {
        const batchResult = await this.downloadAndStorePhotos.execute(unit, correlationId);
        /* v8 ignore next 3 -- DownloadAndStorePhotos.execute's Result<PhotoBatchResult, never> never resolves to the error branch. */
        if (!batchResult.ok) {
          throw new Error("unreachable: DownloadAndStorePhotos.execute never returns an error");
        }
        photoResults.push(batchResult.value);
      }
    }

    return ok({ session, diff, photoResults });
  }
}

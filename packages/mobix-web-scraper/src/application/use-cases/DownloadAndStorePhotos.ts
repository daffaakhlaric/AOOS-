import { AssetType, type UploadAsset } from "@aos/asset-library";
import { err, ok, type Result } from "@aos/common";

import type { IUnitDetailFetcher } from "../../contracts/IUnitDetailFetcher.js";
import type { ScrapedUnit } from "../../domain/entities/ScrapedUnit.js";
import { PhotoDownloadError } from "../../domain/errors/PhotoDownloadError.js";
import type { MobixScraperEvents } from "../../domain/events/MobixScraperEvents.js";

export interface PhotoUploadResult {
  readonly photoUrl: string;
  readonly assetId: string;
  readonly publicUrl: string;
}

export interface PhotoUploadFailure {
  readonly photoUrl: string;
  readonly reason: string;
}

export interface PhotoBatchResult {
  readonly unitIdentityKey: string;
  readonly succeeded: ReadonlyArray<PhotoUploadResult>;
  readonly failed: ReadonlyArray<PhotoUploadFailure>;
  /**
   * The photo URLs this batch actually worked from — the unit's FULL gallery when an
   * `IUnitDetailFetcher` was wired in and its fetch succeeded, otherwise the listing thumbnail the
   * unit arrived with. Exposed so callers can persist the same complete set they downloaded (see
   * `RunFullScrape`/`ScrapeUnit`, which feed it back through `ScrapedUnit.withPhotos`).
   */
  readonly resolvedPhotos: ReadonlyArray<string>;
  /** Why the full-gallery fetch was skipped, when it failed and the batch fell back to the thumbnail. */
  readonly detailFetchFailed?: string;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MIME_TYPE = "image/jpeg";

const EXTENSION_TO_MIME: Readonly<Record<string, string>> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Resolves a unit's FULL photo gallery, then downloads every photo and uploads each one to
 * `@aos/asset-library` via the real `UploadAsset` use case (`type: AssetType.UNIT_PHOTO`), tagged
 * with the unit's identity key, model, year, and branch.
 *
 * GALLERY RESOLUTION (post-API-migration): mobixbydss.id's listing endpoint
 * (`/api/get-all-produk`) carries only ONE `thumbnail` per unit, so a `ScrapedUnit` straight off the
 * listing has a single photo. When an `IUnitDetailFetcher` is wired in, this use case first calls
 * `/api/get-detail-produk` for the unit's slug and downloads that unit's complete `galeri` (~11
 * photos on real units) instead — which is what keeps the "all of a unit's photos get ingested"
 * behavior real after dropping HTML scraping. Both callers get this automatically:
 * `RunFullScrape` (for each newly-detected unit only) and `ScrapeUnit` (for the one re-scraped unit).
 *
 * Partial-failure-tolerant by design: a download or upload failure for ONE photo (network error,
 * timeout, CORS/403, non-2xx status, `UploadAsset` rejecting the input) is collected into
 * `PhotoBatchResult.failed` rather than thrown or short-circuiting the rest of the batch — the
 * spec's "one failed photo must not fail the whole unit's photo batch" requirement. A failed
 * DETAIL fetch is tolerated the same way: it falls back to the listing thumbnail and reports why via
 * `PhotoBatchResult.detailFetchFailed`, rather than ingesting nothing for that unit. This is why
 * `execute()` returns `Result<PhotoBatchResult, never>` (mirrors `DetectInventoryChanges`'s
 * `Result<InventoryDiff, never>`): the use case itself never fails, only individual photos do.
 */
export class DownloadAndStorePhotos {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(
    private readonly uploadAsset: UploadAsset,
    private readonly events: MobixScraperEvents,
    private readonly tenantId: string,
    private readonly now: () => Date = () => new Date(),
    fetchImpl: typeof fetch = fetch,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
    private readonly unitDetailFetcher?: IUnitDetailFetcher,
  ) {
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async execute(
    unit: ScrapedUnit,
    correlationId?: string,
  ): Promise<Result<PhotoBatchResult, never>> {
    const succeeded: PhotoUploadResult[] = [];
    const failed: PhotoUploadFailure[] = [];
    const effectiveCorrelationId = correlationId ?? unit.identityKey;

    let resolvedPhotos: ReadonlyArray<string> = unit.photos;
    let detailFetchFailed: string | undefined;
    if (this.unitDetailFetcher) {
      const detail = await this.unitDetailFetcher.fetchDetail(unit.identityKey);
      if (detail.ok) {
        // An empty `galeri` is not an error — but neither is it a reason to throw away the thumbnail
        // we already have, so the thumbnail is kept in that case.
        if (detail.value.photos.length > 0) {
          resolvedPhotos = detail.value.photos;
        }
      } else {
        detailFetchFailed = detail.error.message;
      }
    }

    for (const photoUrl of resolvedPhotos) {
      const downloaded = await this.download(photoUrl);
      if (!downloaded.ok) {
        failed.push({ photoUrl, reason: downloaded.error.message });
        continue;
      }

      const uploadResult = await this.uploadAsset.execute({
        file: downloaded.value.buffer,
        fileName: downloaded.value.fileName,
        mimeType: downloaded.value.mimeType,
        type: AssetType.UNIT_PHOTO,
        unitId: unit.identityKey,
        unitModel: unit.model,
        unitYear: unit.year,
        branch: unit.branch,
        tenantId: this.tenantId,
        correlationId: effectiveCorrelationId,
      });
      if (!uploadResult.ok) {
        failed.push({ photoUrl, reason: uploadResult.error.message });
        continue;
      }

      const assetId = uploadResult.value.id.toString();
      const publicUrl = uploadResult.value.publicUrl.toString();
      succeeded.push({ photoUrl, assetId, publicUrl });
      await this.events.publishPhotoUploaded(
        {
          identityKey: unit.identityKey,
          photoUrl,
          assetId,
          publicUrl,
          occurredAt: this.now(),
          version: "1.0",
        },
        effectiveCorrelationId,
      );
    }

    return ok({
      unitIdentityKey: unit.identityKey,
      succeeded,
      failed,
      resolvedPhotos,
      ...(detailFetchFailed !== undefined ? { detailFetchFailed } : {}),
    });
  }

  private async download(
    photoUrl: string,
  ): Promise<Result<{ buffer: Buffer; fileName: string; mimeType: string }, PhotoDownloadError>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(photoUrl, { signal: controller.signal });
    } catch (error) {
      return err(
        new PhotoDownloadError(`DownloadAndStorePhotos: fetch failed for ${photoUrl}`, {
          cause: error instanceof Error ? error : undefined,
        }),
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return err(
        new PhotoDownloadError(
          `DownloadAndStorePhotos: ${photoUrl} responded with status ${response.status}`,
        ),
      );
    }

    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await response.arrayBuffer();
    } catch (error) {
      return err(
        new PhotoDownloadError(
          `DownloadAndStorePhotos: failed to read response body for ${photoUrl}`,
          { cause: error instanceof Error ? error : undefined },
        ),
      );
    }

    const buffer = Buffer.from(arrayBuffer);
    const mimeType =
      response.headers.get("content-type")?.split(";")[0]?.trim() || mimeFromUrl(photoUrl);
    const fileName = fileNameFromUrl(photoUrl);
    return ok({ buffer, fileName, mimeType });
  }
}

function mimeFromUrl(url: string): string {
  const match = /\.([a-zA-Z0-9]+)(?:[?#]|$)/.exec(url);
  const ext = match?.[1]?.toLowerCase();
  return (ext && EXTENSION_TO_MIME[ext]) || DEFAULT_MIME_TYPE;
}

function fileNameFromUrl(url: string): string {
  /* v8 ignore start -- unreachable in practice: `url` only ever reaches here after `this.fetchImpl(url, ...)`
     already succeeded, and native `fetch` rejects non-absolute-URL strings before returning a `Response`, so
     `new URL(url)` below can never throw for a `url` that got this far. Kept defensive rather than asserted. */
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter((s) => s.length > 0);
    return segments.length > 0 ? segments[segments.length - 1]! : "photo.jpg";
  } catch {
    return "photo.jpg";
  }
  /* v8 ignore stop */
}

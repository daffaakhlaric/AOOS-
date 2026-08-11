import { AssetType, type UploadAsset } from "@aos/asset-library";
import { err, ok, type Result } from "@aos/common";

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
 * Downloads every photo URL already extracted onto a `ScrapedUnit` (by `UnitListingParser` — see
 * that file's `PHOTO_PATTERN`) and uploads each one to `@aos/asset-library` via the real
 * `UploadAsset` use case (`type: AssetType.UNIT_PHOTO`), tagged with the unit's identity key,
 * model, year, and branch.
 *
 * Partial-failure-tolerant by design: a download or upload failure for ONE photo (network error,
 * timeout, CORS/403, non-2xx status, `UploadAsset` rejecting the input) is collected into
 * `PhotoBatchResult.failed` rather than thrown or short-circuiting the rest of the batch — the
 * spec's "one failed photo must not fail the whole unit's photo batch" requirement. This is why
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

    for (const photoUrl of unit.photos) {
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

    return ok({ unitIdentityKey: unit.identityKey, succeeded, failed });
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

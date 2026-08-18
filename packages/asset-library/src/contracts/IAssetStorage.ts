import type { Result } from "@aos/common";

import type { StorageError } from "../domain/errors/StorageError.js";

export interface UploadFileInput {
  readonly path: string;
  readonly fileBody: Buffer;
  readonly contentType: string;
}

export interface UploadedFile {
  readonly path: string;
  readonly publicUrl: string;
}

/** Port over file-byte storage (Hexagonal Architecture — spec: `IAssetStorage.ts ← storage port`). Implemented by `infrastructure/gcs/GcsStorageClient.ts` (Google Cloud Storage, since AAOS-W3E-S1 — originally Supabase Storage). */
export interface IAssetStorage {
  upload(input: UploadFileInput): Promise<Result<UploadedFile, StorageError>>;
  /**
   * A time-limited, read-only download URL for `path` (AAOS-SCRAPER-ASSET-LIBRARY). Backs
   * `GET /api/v1/assets/:id/download` — the Asset Library page's download action never hands the
   * browser a permanent credential, and works even for objects that are NOT publicly readable
   * (unlike `GcsStorageClient.getPublicUrl`, which assumes bucket-level `allUsers` read access).
   */
  getSignedUrl(path: string, expirySeconds: number): Promise<Result<string, StorageError>>;
}

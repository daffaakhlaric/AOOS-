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
}

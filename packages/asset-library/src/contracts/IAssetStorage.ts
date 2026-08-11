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

/** Port over Supabase Storage (Hexagonal Architecture — spec: `IAssetStorage.ts ← Supabase Storage port`). Implemented by `infrastructure/supabase/SupabaseStorageClient.ts`. */
export interface IAssetStorage {
  upload(input: UploadFileInput): Promise<Result<UploadedFile, StorageError>>;
}

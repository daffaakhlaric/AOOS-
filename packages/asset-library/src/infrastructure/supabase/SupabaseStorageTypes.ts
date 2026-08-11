/**
 * A minimal, hand-written structural port over the parts of `@supabase/supabase-js`'s
 * `.storage` Storage API this package uses (`.from(bucket).upload(...)` /
 * `.getPublicUrl(...)`), modeled from `@supabase/storage-js`'s real `StorageFileApi`
 * (`upload(path, fileBody, fileOptions)` resolving `{ data: { path, fullPath }, error }` on
 * success or `{ data: null, error }` on failure; `getPublicUrl(path)` returning
 * `{ data: { publicUrl } }` synchronously, no error channel). This is a DIFFERENT shape than the
 * Postgrest query builder in `SupabaseTypes.ts` — Storage has no `.eq()`/`.select()` fluent chain,
 * just direct verb methods — so it gets its own port rather than reusing `SupabaseFilterBuilderLike`.
 * `SupabaseClient.ts` bridges the real `createClient(...).storage` to this port at the single
 * composition boundary.
 */
export interface StorageUploadOptions {
  readonly contentType?: string;
  readonly upsert?: boolean;
}

export interface StorageUploadData {
  readonly id?: string;
  readonly path: string;
  readonly fullPath: string;
}

export interface StorageErrorLike {
  readonly message: string;
  readonly name?: string;
}

export type StorageUploadResult =
  | { readonly data: StorageUploadData; readonly error: null }
  | { readonly data: null; readonly error: StorageErrorLike };

export interface SupabaseStorageBucketLike {
  upload(
    path: string,
    fileBody: Buffer,
    options?: StorageUploadOptions,
  ): Promise<StorageUploadResult>;
  getPublicUrl(path: string): { readonly data: { readonly publicUrl: string } };
}

export interface SupabaseStorageClientLike {
  from(bucket: string): SupabaseStorageBucketLike;
}

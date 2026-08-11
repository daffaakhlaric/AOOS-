import { vi } from "vitest";

import type {
  StorageUploadOptions,
  StorageUploadResult,
  SupabaseStorageBucketLike,
  SupabaseStorageClientLike,
} from "../../src/infrastructure/supabase/SupabaseStorageTypes.js";

/**
 * A minimal, in-memory, hand-rolled `SupabaseStorageClientLike` test double — the mock strategy
 * the spec requires ("mock `@supabase/supabase-js`... zero real network calls"). Modeled on the
 * real `@supabase/storage-js` `StorageFileApi.upload`/`.getPublicUrl` shape (see
 * `SupabaseStorageTypes.ts`'s docstring): `upload` resolves `{ data: { path, fullPath }, error:
 * null }` on success or `{ data: null, error }` on failure; `getPublicUrl` returns
 * `{ data: { publicUrl } }` synchronously — a DIFFERENT shape than the Postgrest query builder
 * mocked in `tests/helpers/supabase.ts`, so it gets its own fake here.
 */
export class FakeSupabaseStorageClient implements SupabaseStorageClientLike {
  readonly buckets = new Map<string, FakeStorageBucket>();
  readonly uploadSpy = vi.fn();
  private forcedError: string | undefined;
  private baseUrl = "https://fake-project.supabase.co";

  /** Forces the NEXT `upload()` call (any bucket) to resolve with `{ data: null, error: { message } }`. Consumed once. */
  forceErrorOnce(message: string): void {
    this.forcedError = message;
  }

  withBaseUrl(baseUrl: string): this {
    this.baseUrl = baseUrl;
    return this;
  }

  from(bucket: string): FakeStorageBucket {
    let existing = this.buckets.get(bucket);
    if (existing === undefined) {
      existing = new FakeStorageBucket(bucket, this);
      this.buckets.set(bucket, existing);
    }
    return existing;
  }

  /** @internal used by `FakeStorageBucket`. */
  consumeForcedError(): string | undefined {
    const pending = this.forcedError;
    this.forcedError = undefined;
    return pending;
  }

  /** @internal used by `FakeStorageBucket`. */
  publicUrlFor(bucket: string, path: string): string {
    return `${this.baseUrl}/storage/v1/object/public/${bucket}/${path}`;
  }

  recordUpload(path: string, fileBody: Buffer, options?: StorageUploadOptions): void {
    this.uploadSpy(path, fileBody, options);
  }
}

class FakeStorageBucket implements SupabaseStorageBucketLike {
  readonly uploadedPaths: string[] = [];

  constructor(
    private readonly bucketName: string,
    private readonly client: FakeSupabaseStorageClient,
  ) {}

  async upload(
    path: string,
    fileBody: Buffer,
    options?: StorageUploadOptions,
  ): Promise<StorageUploadResult> {
    this.client.recordUpload(path, fileBody, options);
    const forcedError = this.client.consumeForcedError();
    if (forcedError !== undefined) {
      return { data: null, error: { message: forcedError } };
    }
    this.uploadedPaths.push(path);
    return {
      data: {
        id: `fake-${String(this.uploadedPaths.length)}`,
        path,
        fullPath: `${this.bucketName}/${path}`,
      },
      error: null,
    };
  }

  getPublicUrl(path: string): { readonly data: { readonly publicUrl: string } } {
    return { data: { publicUrl: this.client.publicUrlFor(this.bucketName, path) } };
  }
}

export function createFakeSupabaseStorageClient(): FakeSupabaseStorageClient {
  return new FakeSupabaseStorageClient();
}

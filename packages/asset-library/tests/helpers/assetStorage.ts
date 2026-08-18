import { err, ok, type Result } from "@aos/common";
import { vi } from "vitest";

import type {
  IAssetStorage,
  UploadedFile,
  UploadFileInput,
} from "../../src/contracts/IAssetStorage.js";
import { StorageError } from "../../src/domain/errors/StorageError.js";

/**
 * A minimal, in-memory, hand-rolled `IAssetStorage` test double — used by every test that only
 * cares about `IAssetStorage`'s contract (e.g. `StorageService`, `UploadAsset`, `SaveAiCreative`,
 * `AssetService`, `AssetLibraryFactory`), NOT about a specific storage backend's wire format.
 * Backend-specific behavior (the real GCS request/response shape) is covered separately by
 * `tests/unit/infrastructure/gcs/GcsStorageClient.spec.ts`, which mocks `@google-cloud/storage`
 * directly. Modeled on `tests/helpers/storage.ts`'s retired `FakeSupabaseStorageClient` (same
 * `forceErrorOnce`/`uploadSpy` ergonomics), adapted to the real `IAssetStorage.upload` shape.
 */
export class FakeAssetStorage implements IAssetStorage {
  readonly uploadSpy = vi.fn();
  readonly uploadedPaths: string[] = [];
  readonly getSignedUrlSpy = vi.fn();
  private forcedError: string | undefined;
  private forcedSignedUrlError: string | undefined;
  private baseUrl = "https://storage.googleapis.com/fake-bucket";

  /** Forces the NEXT `upload()` call to resolve with a `StorageError`. Consumed once. */
  forceErrorOnce(message: string): void {
    this.forcedError = message;
  }

  /** Forces the NEXT `getSignedUrl()` call to resolve with a `StorageError`. Consumed once. */
  forceSignedUrlErrorOnce(message: string): void {
    this.forcedSignedUrlError = message;
  }

  withBaseUrl(baseUrl: string): this {
    this.baseUrl = baseUrl;
    return this;
  }

  async upload(input: UploadFileInput): Promise<Result<UploadedFile, StorageError>> {
    this.uploadSpy(input.path, input.fileBody, {
      contentType: input.contentType,
      upsert: false,
    });
    if (this.forcedError !== undefined) {
      const message = this.forcedError;
      this.forcedError = undefined;
      return err(new StorageError(`FakeAssetStorage.upload failed: ${message}`));
    }
    this.uploadedPaths.push(input.path);
    return ok({ path: input.path, publicUrl: `${this.baseUrl}/${input.path}` });
  }

  async getSignedUrl(path: string, expirySeconds: number): Promise<Result<string, StorageError>> {
    this.getSignedUrlSpy(path, expirySeconds);
    if (this.forcedSignedUrlError !== undefined) {
      const message = this.forcedSignedUrlError;
      this.forcedSignedUrlError = undefined;
      return err(new StorageError(`FakeAssetStorage.getSignedUrl failed: ${message}`));
    }
    return ok(`${this.baseUrl}/${path}?signed=1&expires=${expirySeconds}`);
  }
}

export function createFakeAssetStorage(): FakeAssetStorage {
  return new FakeAssetStorage();
}

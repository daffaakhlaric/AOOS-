import { err, ok, type Result } from "@aos/common";
import { Storage } from "@google-cloud/storage";

import type { AssetLibraryConfig } from "../../config/AssetLibraryConfig.js";
import type {
  IAssetStorage,
  UploadedFile,
  UploadFileInput,
} from "../../contracts/IAssetStorage.js";
import { StorageError } from "../../domain/errors/StorageError.js";

/**
 * Structural mirror of `google-auth-library`'s `JWTInput` — the shape of a GCP service-account
 * JSON credentials file/string (`type`/`project_id`/`private_key`/`client_email`/...). Not
 * re-exported by `@google-cloud/storage`'s public API, so this package hand-rolls the subset of
 * fields it passes through to `Storage`'s `credentials` option, mirroring
 * `SupabaseClient.ts`'s single-composition-boundary `unknown`-mediated cast discipline (never
 * `any`).
 */
interface GcsServiceAccountCredentials {
  readonly type?: string;
  readonly project_id?: string;
  readonly private_key_id?: string;
  readonly private_key?: string;
  readonly client_email?: string;
  readonly client_id?: string;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Google Cloud Storage implementation of `IAssetStorage` (replaces
 * `infrastructure/supabase/SupabaseStorageClient.ts` — AAOS-W3E-S1). Uploads bytes to the
 * configured GCS bucket via the real `@google-cloud/storage` SDK and resolves the public URL.
 * Mirrors `SupabaseStorageClient`'s error-wrapping discipline (`StorageError` inside
 * `Result.err`, never thrown, for every expected/recoverable failure).
 *
 * Auth resolution order (design resolution #3 — not specified by the spec, a judgment call):
 * `config.gcsCredentials` (parsed JSON string) takes precedence over `config.gcsKeyFilePath`
 * (path to a key file on disk) when both are provided. At least one of the two MUST be provided
 * — this class's own constructor enforces that defensively (throws `StorageError`) in addition
 * to `AssetLibraryConfigSchema`'s Zod-level validation (design resolution #2), since this
 * constructor can be called directly (e.g. in unit tests) without going through
 * `parseAssetLibraryConfig`. `GOOGLE_APPLICATION_CREDENTIALS` / Application Default Credentials
 * are intentionally NOT special-cased here — see `AssetLibraryConfig.ts`'s docstring.
 */
export class GcsStorageClient implements IAssetStorage {
  private readonly storage: Storage;
  private readonly bucketName: string;

  constructor(config: AssetLibraryConfig) {
    if (config.gcsCredentials === undefined && config.gcsKeyFilePath === undefined) {
      throw new StorageError(
        "GcsStorageClient requires either gcsCredentials (a JSON string) or gcsKeyFilePath " +
          "(a path to a key file) to be configured",
      );
    }

    this.bucketName = config.gcsBucketName;
    this.storage = new Storage({
      projectId: config.gcsProjectId,
      ...(config.gcsCredentials !== undefined
        ? { credentials: JSON.parse(config.gcsCredentials) as GcsServiceAccountCredentials }
        : { keyFilename: config.gcsKeyFilePath }),
    });
  }

  async upload(input: UploadFileInput): Promise<Result<UploadedFile, StorageError>> {
    try {
      const file = this.storage.bucket(this.bucketName).file(input.path);
      await file.save(input.fileBody, {
        contentType: input.contentType,
        resumable: false,
      });
      return ok({ path: input.path, publicUrl: this.getPublicUrl(input.path) });
    } catch (error) {
      return err(new StorageError(`GcsStorageClient.upload failed: ${toErrorMessage(error)}`));
    }
  }

  async download(path: string): Promise<Result<Buffer, StorageError>> {
    try {
      const [buffer] = await this.storage.bucket(this.bucketName).file(path).download();
      return ok(buffer);
    } catch (error) {
      return err(new StorageError(`GcsStorageClient.download failed: ${toErrorMessage(error)}`));
    }
  }

  async delete(path: string): Promise<Result<void, StorageError>> {
    try {
      await this.storage.bucket(this.bucketName).file(path).delete();
      return ok(undefined);
    } catch (error) {
      return err(new StorageError(`GcsStorageClient.delete failed: ${toErrorMessage(error)}`));
    }
  }

  /**
   * Real V4 signed read URL via `@google-cloud/storage`'s own `file.getSignedUrl(...)`
   * (AAOS-SCRAPER-ASSET-LIBRARY). `expires` is an absolute epoch-ms deadline, computed here from
   * the caller's relative `expirySeconds` — the SDK accepts either, and a relative-seconds
   * argument would be silently misread as an epoch timestamp in 1970. Requires the configured
   * service account to have a private key (it signs locally); a metadata-server-only credential
   * would make the SDK throw, which is caught and wrapped as `StorageError` like every other
   * failure in this class.
   */
  async getSignedUrl(path: string, expirySeconds: number): Promise<Result<string, StorageError>> {
    if (!Number.isFinite(expirySeconds) || expirySeconds <= 0) {
      return err(
        new StorageError(
          `GcsStorageClient.getSignedUrl: expirySeconds must be a positive number, received: ${String(expirySeconds)}`,
        ),
      );
    }
    try {
      const [url] = await this.storage
        .bucket(this.bucketName)
        .file(path)
        .getSignedUrl({
          version: "v4",
          action: "read",
          expires: Date.now() + expirySeconds * 1000,
        });
      return ok(url);
    } catch (error) {
      return err(
        new StorageError(`GcsStorageClient.getSignedUrl failed: ${toErrorMessage(error)}`),
      );
    }
  }

  /** GCS public URL for a publicly-readable object (bucket-level IAM `allUsers` → Storage Object Viewer — see README). */
  getPublicUrl(path: string): string {
    return `https://storage.googleapis.com/${this.bucketName}/${path}`;
  }
}

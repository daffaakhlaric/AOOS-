import { err, ok, type Result } from "@aos/common";

import type { AssetLibraryConfig } from "../../config/AssetLibraryConfig.js";
import type { IAssetStorage } from "../../contracts/IAssetStorage.js";
import { AssetError } from "../../domain/errors/AssetError.js";
import { FileSizeLimitError } from "../../domain/errors/FileSizeLimitError.js";
import { InvalidFileTypeError } from "../../domain/errors/InvalidFileTypeError.js";
import { StorageError } from "../../domain/errors/StorageError.js";
import { FileSize } from "../../domain/value-objects/FileSize.js";
import { MimeType } from "../../domain/value-objects/MimeType.js";
import { PublicUrl } from "../../domain/value-objects/PublicUrl.js";
import type { StoragePath } from "../../domain/value-objects/StoragePath.js";

export interface StoredFile {
  readonly mimeType: MimeType;
  readonly fileSize: FileSize;
  readonly publicUrl: PublicUrl;
}

/**
 * Wraps `IAssetStorage` (spec: `StorageService.ts ← wraps Supabase Storage`) with the spec's File
 * Validation rules — MIME allow-list and size limits — applied uniformly across every `AssetType`
 * (design resolution #4). Size limits come from `AssetLibraryConfig`, never hardcoded here.
 */
export class StorageService {
  constructor(
    private readonly storage: IAssetStorage,
    private readonly config: AssetLibraryConfig,
  ) {}

  async store(
    path: StoragePath,
    file: Buffer,
    rawMimeType: string,
  ): Promise<Result<StoredFile, AssetError>> {
    const mimeTypeResult = MimeType.create(rawMimeType);
    if (!mimeTypeResult.ok) {
      return err(new InvalidFileTypeError(mimeTypeResult.error.message));
    }
    const mimeType = mimeTypeResult.value;

    const fileSizeResult = FileSize.create(file.length);
    /* v8 ignore start -- file.length from a real Buffer is always a non-negative integer, so
       FileSize.create's only failure mode can never trigger here. */
    if (!fileSizeResult.ok) {
      return err(new AssetError(fileSizeResult.error.message));
    }
    /* v8 ignore stop */
    const fileSize = fileSizeResult.value;

    const limitBytes = mimeType.isVideo()
      ? this.config.videoSizeLimitBytes
      : this.config.imageSizeLimitBytes;
    if (fileSize.exceeds(limitBytes)) {
      return err(
        new FileSizeLimitError(
          `File size ${String(fileSize.bytes)} bytes exceeds the ${mimeType.isVideo() ? "video" : "image"} limit of ${String(limitBytes)} bytes`,
        ),
      );
    }

    const uploadResult = await this.storage.upload({
      path: path.toString(),
      fileBody: file,
      contentType: mimeType.toString(),
    });
    if (!uploadResult.ok) {
      return err(uploadResult.error);
    }

    const publicUrlResult = PublicUrl.create(uploadResult.value.publicUrl);
    /* v8 ignore start -- Supabase Storage's getPublicUrl always returns a well-formed http(s) URL
       built from this package's own configured supabaseUrl, so PublicUrl.create's failure modes
       can never trigger here. */
    if (!publicUrlResult.ok) {
      return err(new StorageError(publicUrlResult.error.message));
    }
    /* v8 ignore stop */

    return ok({ mimeType, fileSize, publicUrl: publicUrlResult.value });
  }
}

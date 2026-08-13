import type { Result } from "@aos/common";

import type { SupportedImageMimeType } from "../../contracts/IFileUploader.js";
import type { UploadedFile } from "../../domain/entities/UploadedFile.js";
import type { FileUploadError } from "../../domain/errors/FileUploadError.js";
import type { FileUploadService } from "../services/FileUploadService.js";

/**
 * Uploads a source photo Buffer (fetched by the caller from `@aos/asset-library` — this package
 * does not depend on `@aos/asset-library` itself, see the README's scope-boundary note) to Kie AI,
 * returning the `fileUrl` every subsequent generation call needs. Thin pass-through over
 * `FileUploadService` — kept as its own use case (rather than folded into the service) so the
 * Public API surfaces a single, testable entry point per spec.
 */
export class UploadSourceImage {
  constructor(private readonly fileUploadService: FileUploadService) {}

  async execute(
    buffer: Buffer,
    fileName: string,
    mimeType: SupportedImageMimeType,
    uploadPath?: string,
    correlationId?: string,
  ): Promise<Result<UploadedFile, FileUploadError>> {
    return this.fileUploadService.upload(buffer, fileName, mimeType, uploadPath, correlationId);
  }
}

import type { Result } from "@aos/common";

import type { UploadedFile } from "../domain/entities/UploadedFile.js";
import type { FileUploadError } from "../domain/errors/FileUploadError.js";

export type SupportedImageMimeType = "image/jpeg" | "image/png" | "image/webp";

/** Port (Hexagonal Architecture) for uploading a source photo to Kie AI. The only implementation is `infrastructure/kie-api/KieAiFileUploadClient.ts`. */
export interface IFileUploader {
  upload(
    buffer: Buffer,
    fileName: string,
    mimeType: SupportedImageMimeType,
    uploadPath?: string,
  ): Promise<Result<UploadedFile, FileUploadError>>;
}

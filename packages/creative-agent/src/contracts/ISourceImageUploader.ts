import type { Result } from "@aos/common";
import type { FileUploadError, UploadedFile } from "@aos/creative-connector";

/** Kie AI's file-stream-upload endpoint only accepts these 3 image MIME types (mirrors `@aos/creative-connector`'s own un-exported `SupportedImageMimeType`). */
export type SupportedImageMimeType = "image/jpeg" | "image/png" | "image/webp";

/** Port (Hexagonal Architecture) for uploading a source photo to Kie AI. The real implementation is `@aos/creative-connector`'s own `UploadSourceImage` use case; an interface is used here for the same testability reason `IPhotoSource` documents. */
export interface ISourceImageUploader {
  execute(
    buffer: Buffer,
    fileName: string,
    mimeType: SupportedImageMimeType,
    uploadPath?: string,
    correlationId?: string,
  ): Promise<Result<UploadedFile, FileUploadError>>;
}

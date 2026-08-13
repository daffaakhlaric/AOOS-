import type { Result } from "@aos/common";

import type { IFileUploader, SupportedImageMimeType } from "../../contracts/IFileUploader.js";
import type { UploadedFile } from "../../domain/entities/UploadedFile.js";
import type { FileUploadError } from "../../domain/errors/FileUploadError.js";
import type { CreativeConnectorEvents } from "../../domain/events/CreativeConnectorEvents.js";

/**
 * Wraps `IFileUploader` (Part 1 of the spec — file upload is always the required first step
 * before any generation call). On success, publishes `FileUploaded`. On failure, returns
 * `Result.err(FileUploadError)` as-is — uploads are never retried by this package, per the spec.
 */
export class FileUploadService {
  constructor(
    private readonly uploader: IFileUploader,
    private readonly events: CreativeConnectorEvents,
    private readonly now: () => Date = (): Date => new Date(),
  ) {}

  async upload(
    buffer: Buffer,
    fileName: string,
    mimeType: SupportedImageMimeType,
    uploadPath?: string,
    correlationId?: string,
  ): Promise<Result<UploadedFile, FileUploadError>> {
    const result = await this.uploader.upload(buffer, fileName, mimeType, uploadPath);
    if (!result.ok) {
      return result;
    }

    await this.events.publishFileUploaded(
      {
        fileId: result.value.fileId.toString(),
        fileUrl: result.value.fileUrl.toString(),
        fileName: result.value.fileName,
        occurredAt: this.now(),
        version: "1.0",
      },
      correlationId,
    );

    return result;
  }
}

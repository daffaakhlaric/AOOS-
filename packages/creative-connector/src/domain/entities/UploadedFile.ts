import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { FileId } from "../value-objects/FileId.js";
import type { FileUrl } from "../value-objects/FileUrl.js";

export interface UploadedFileProps {
  readonly fileId: FileId;
  readonly fileUrl: FileUrl;
  readonly fileName: string;
  /** The upload's own timestamp — Kie AI expires the file 24h after this (Part 1 of the spec). Used only for observability; this package does not itself enforce the expiry. */
  readonly uploadedAt: Date;
}

/** A source photo successfully uploaded to Kie AI's file-stream-upload endpoint — the input every generation call needs (`imageUrls`/`image_url`). */
export class UploadedFile {
  private constructor(private readonly props: UploadedFileProps) {}

  static create(props: UploadedFileProps): Result<UploadedFile, ValidationError> {
    if (typeof props.fileName !== "string" || props.fileName.trim().length === 0) {
      return err(new ValidationError("UploadedFile.fileName must be a non-empty string"));
    }
    return ok(new UploadedFile(props));
  }

  get fileId(): FileId {
    return this.props.fileId;
  }

  get fileUrl(): FileUrl {
    return this.props.fileUrl;
  }

  get fileName(): string {
    return this.props.fileName;
  }

  get uploadedAt(): Date {
    return this.props.uploadedAt;
  }

  /** True once the 24h upload-expiry window has elapsed relative to `at` (defaults to now). */
  isExpired(at: Date = new Date()): boolean {
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    return at.getTime() - this.props.uploadedAt.getTime() >= TWENTY_FOUR_HOURS_MS;
  }
}

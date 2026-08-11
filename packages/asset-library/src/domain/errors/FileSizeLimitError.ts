import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { AssetError } from "./AssetError.js";

/** Raised when an uploaded file exceeds the applicable size limit (10MB image / 100MB video, spec's "File Validation"). */
export class FileSizeLimitError extends AssetError {
  constructor(message: string, options?: AosErrorOptions) {
    super(message, { ...options, code: ErrorCode.VALIDATION_ERROR });
  }
}

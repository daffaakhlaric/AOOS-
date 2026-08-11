import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { AssetError } from "./AssetError.js";

/** Raised when an uploaded file's MIME type is not in the spec's global allow-list (jpeg/png/webp/mp4). */
export class InvalidFileTypeError extends AssetError {
  constructor(message: string, options?: AosErrorOptions) {
    super(message, { ...options, code: ErrorCode.VALIDATION_ERROR });
  }
}

import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { CreativeConnectorError } from "./CreativeConnectorError.js";

/**
 * `FileUploadService.upload()` failed — either a caller input problem (unsupported mime type,
 * caught before any network call, `ErrorCode.VALIDATION_ERROR`) or a real failure talking to
 * `kieai.redpandaai.co` (network error / non-2xx response, `ErrorCode.UNAVAILABLE`, the default).
 * Per the spec, uploads are never retried — a failure is reported as-is, not masked behind a
 * retry loop.
 */
export class FileUploadError extends CreativeConnectorError {
  constructor(
    message: string,
    options: AosErrorOptions = {},
    code: ErrorCode = ErrorCode.UNAVAILABLE,
  ) {
    super(code, message, options);
  }
}

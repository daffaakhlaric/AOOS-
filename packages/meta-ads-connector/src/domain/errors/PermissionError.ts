import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { MetaApiError } from "./MetaApiError.js";

const META_MISSING_PERMISSION_CODE = 200;

/** Meta error code 200 — the token/app is missing a required permission. Not retryable. */
export class PermissionError extends MetaApiError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(
      message,
      { ...options, metaErrorCode: META_MISSING_PERMISSION_CODE, httpStatus: 403 },
      ErrorCode.FORBIDDEN,
    );
  }
}

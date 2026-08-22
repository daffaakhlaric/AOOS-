import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { MetaGraphApiError } from "./MetaGraphApiError.js";

const META_INVALID_TOKEN_CODE = 190;

/** Meta error code 190 — access token invalid or expired. Not retryable. */
export class AuthError extends MetaGraphApiError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(
      message,
      { ...options, metaErrorCode: META_INVALID_TOKEN_CODE, httpStatus: 401 },
      ErrorCode.UNAUTHORIZED,
    );
  }
}

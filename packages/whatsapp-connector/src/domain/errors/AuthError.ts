import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { WhatsAppApiError } from "./WhatsAppApiError.js";

const META_INVALID_TOKEN_CODE = 190;

/** Meta error code 190 (or a bare HTTP 401) — access token invalid/expired. Not retryable. */
export class AuthError extends WhatsAppApiError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(
      message,
      { ...options, metaErrorCode: META_INVALID_TOKEN_CODE, httpStatus: 401 },
      ErrorCode.UNAUTHORIZED,
    );
  }
}

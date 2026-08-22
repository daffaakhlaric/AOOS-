import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { MetaGraphApiError } from "./MetaGraphApiError.js";

const META_MISSING_PERMISSION_CODE = 200;

/** Meta error code 200 — the token/app is missing a required permission (e.g. `pages_manage_posts`/`instagram_content_publish`). Not retryable. */
export class PermissionError extends MetaGraphApiError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(
      message,
      { ...options, metaErrorCode: META_MISSING_PERMISSION_CODE, httpStatus: 403 },
      ErrorCode.FORBIDDEN,
    );
  }
}

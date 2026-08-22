import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { MetaOrganicConnectorError } from "./MetaOrganicConnectorError.js";

export interface MetaGraphApiErrorOptions extends AosErrorOptions {
  /** Meta's own numeric error code (e.g. 190, 200), when the failure came from a Graph API response. */
  readonly metaErrorCode?: number;
  readonly httpStatus?: number;
}

/** Base class for every Meta Graph API (Pages/Instagram content publishing) failure mode. */
export class MetaGraphApiError extends MetaOrganicConnectorError {
  public readonly metaErrorCode: number | undefined;
  public readonly httpStatus: number | undefined;

  constructor(
    message: string,
    options: MetaGraphApiErrorOptions = {},
    code: ErrorCode = ErrorCode.UNAVAILABLE,
  ) {
    super(code, message, options);
    this.metaErrorCode = options.metaErrorCode;
    this.httpStatus = options.httpStatus;
  }
}

/** Generic 500/503 Meta server-side failure, or a lower-level network/timeout failure — both are retryable. */
export class ApiServerError extends MetaGraphApiError {
  constructor(message: string, options: MetaGraphApiErrorOptions = {}) {
    super(message, options, ErrorCode.UNAVAILABLE);
  }
}

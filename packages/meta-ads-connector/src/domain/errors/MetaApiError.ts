import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { MetaAdsConnectorError } from "./MetaAdsConnectorError.js";

export interface MetaApiErrorOptions extends AosErrorOptions {
  /** Meta's own numeric error code (e.g. 190, 200), when the failure came from a Graph API response. */
  readonly metaErrorCode?: number;
  readonly httpStatus?: number;
}

/** Base class for every Meta Graph API failure mode. */
export class MetaApiError extends MetaAdsConnectorError {
  public readonly metaErrorCode: number | undefined;
  public readonly httpStatus: number | undefined;

  constructor(
    message: string,
    options: MetaApiErrorOptions = {},
    code: ErrorCode = ErrorCode.UNAVAILABLE,
  ) {
    super(code, message, options);
    this.metaErrorCode = options.metaErrorCode;
    this.httpStatus = options.httpStatus;
  }
}

/** Generic 500/503 Meta server-side failure, or a lower-level network/timeout failure — both are retryable. */
export class ApiServerError extends MetaApiError {
  constructor(message: string, options: MetaApiErrorOptions = {}) {
    super(message, options, ErrorCode.UNAVAILABLE);
  }
}

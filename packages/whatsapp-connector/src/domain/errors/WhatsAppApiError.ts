import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { WhatsAppConnectorError } from "./WhatsAppConnectorError.js";

export interface WhatsAppApiErrorOptions extends AosErrorOptions {
  /** Meta's own numeric error code (e.g. 190), when the failure came from a Graph API response. */
  readonly metaErrorCode?: number;
  readonly httpStatus?: number;
}

/** Base class for every WhatsApp Cloud API failure mode. */
export class WhatsAppApiError extends WhatsAppConnectorError {
  public readonly metaErrorCode: number | undefined;
  public readonly httpStatus: number | undefined;

  constructor(
    message: string,
    options: WhatsAppApiErrorOptions = {},
    code: ErrorCode = ErrorCode.UNAVAILABLE,
  ) {
    super(code, message, options);
    this.metaErrorCode = options.metaErrorCode;
    this.httpStatus = options.httpStatus;
  }
}

/** Generic 500/503 WhatsApp Cloud API server-side failure, or a network/timeout failure — both retryable. */
export class ApiServerError extends WhatsAppApiError {
  constructor(message: string, options: WhatsAppApiErrorOptions = {}) {
    super(message, options, ErrorCode.UNAVAILABLE);
  }
}

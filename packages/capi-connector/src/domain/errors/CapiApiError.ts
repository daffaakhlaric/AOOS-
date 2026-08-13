import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { CapiError } from "./CapiError.js";

export interface CapiApiErrorOptions extends AosErrorOptions {
  /** Meta's own numeric error subcode, when the failure came from a Graph API error payload. */
  readonly metaErrorCode?: number;
  readonly httpStatus?: number;
}

/**
 * Base class for every Meta Conversions API (`graph.facebook.com/{api-version}/{pixel-id}/events`)
 * failure mode — network failure, non-2xx response, or a malformed response body. Mirrors
 * `@aos/meta-ads-connector`'s `MetaApiError` (this package deliberately keeps its own copy
 * rather than importing that package's error hierarchy — CAPI's error shape/retry policy is
 * independently owned here).
 */
export class CapiApiError extends CapiError {
  public readonly metaErrorCode: number | undefined;
  public readonly httpStatus: number | undefined;

  constructor(
    message: string,
    options: CapiApiErrorOptions = {},
    code: ErrorCode = ErrorCode.UNAVAILABLE,
  ) {
    super(message, { ...options, code });
    this.metaErrorCode = options.metaErrorCode;
    this.httpStatus = options.httpStatus;
  }
}

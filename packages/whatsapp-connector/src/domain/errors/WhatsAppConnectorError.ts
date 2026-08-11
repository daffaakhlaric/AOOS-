import type { ErrorCode } from "@aos/common";
import { AosError, type AosErrorOptions } from "@aos/errors";

/**
 * Base class for every error this package throws-as-a-value (always inside a `Result.err`, never
 * actually thrown across an async boundary for an expected/recoverable failure). Extends
 * `@aos/errors`' `AosError`, per the exact same pattern `@aos/meta-ads-connector`'s
 * `MetaAdsConnectorError` establishes — each subclass below picks the closest-matching generic
 * `ErrorCode` and carries package-specific detail in `context`.
 */
export class WhatsAppConnectorError extends AosError {
  constructor(code: ErrorCode, message: string, options?: AosErrorOptions) {
    super(code, message, options);
  }
}

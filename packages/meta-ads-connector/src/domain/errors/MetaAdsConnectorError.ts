import type { ErrorCode } from "@aos/common";
import { AosError, type AosErrorOptions } from "@aos/errors";

/**
 * Base class for every error this package throws-as-a-value (always inside a `Result.err`,
 * never actually thrown across an async boundary for expected failures). Extends `@aos/errors`'
 * `AosError` per the Technical Requirements, picking the closest-matching generic `ErrorCode`
 * per subclass and carrying package-specific detail in `context`.
 */
export class MetaAdsConnectorError extends AosError {
  constructor(code: ErrorCode, message: string, options?: AosErrorOptions) {
    super(code, message, options);
  }
}

import type { ErrorCode } from "@aos/common";
import { AosError, type AosErrorOptions } from "@aos/errors";

/**
 * Base class for every error this package returns-as-a-value (always inside a `Result.err`,
 * never thrown across an async boundary for expected failures — see Hard Constraints). Extends
 * `@aos/errors`' `AosError` per the Technical Requirements, mirroring
 * `@aos/meta-ads-connector`'s `MetaAdsConnectorError` base-class pattern.
 */
export class ObjectiveError extends AosError {
  constructor(code: ErrorCode, message: string, options?: AosErrorOptions) {
    super(code, message, options);
  }
}

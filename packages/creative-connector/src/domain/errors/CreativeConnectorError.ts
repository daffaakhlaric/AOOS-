import type { ErrorCode } from "@aos/common";
import { AosError, type AosErrorOptions } from "@aos/errors";

/**
 * Base class for every error this package returns-as-a-value (always inside a `Result.err`,
 * never thrown for expected/recoverable failures). Extends `@aos/errors`' `AosError`, mirroring
 * `@aos/mobix-web-scraper`'s `ScraperError` / `@aos/meta-ads-connector`'s `MetaApiError`
 * base-class convention: one root type per package, concrete subclasses per failure mode.
 */
export class CreativeConnectorError extends AosError {
  constructor(code: ErrorCode, message: string, options?: AosErrorOptions) {
    super(code, message, options);
  }
}

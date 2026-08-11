import type { ErrorCode } from "@aos/common";
import { AosError, type AosErrorOptions } from "@aos/errors";

/**
 * Base class for every error this package returns-as-a-value (always inside a `Result.err`,
 * never thrown for expected/recoverable failures). Extends `@aos/errors`' `AosError`, mirroring
 * `@aos/meta-ads-agent`'s `AgentError` base-class pattern.
 */
export class ScraperError extends AosError {
  constructor(code: ErrorCode, message: string, options?: AosErrorOptions) {
    super(code, message, options);
  }
}

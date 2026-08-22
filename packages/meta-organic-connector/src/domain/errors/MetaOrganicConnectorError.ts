import type { ErrorCode } from "@aos/common";
import { AosError, type AosErrorOptions } from "@aos/errors";

/**
 * Base class for every error this package throws-as-a-value (always inside a `Result.err`, never
 * actually thrown across an async boundary for expected failures). Extends `@aos/errors`'
 * `AosError`, mirroring `@aos/meta-ads-connector`'s `MetaAdsConnectorError` — same discipline,
 * separate class hierarchy since this package is a separate composition root (coordinator note
 * point 1 on `docs/PROMPT-AAOS-SOSMED-AUTOMATION.md`).
 */
export class MetaOrganicConnectorError extends AosError {
  constructor(code: ErrorCode, message: string, options?: AosErrorOptions) {
    super(code, message, options);
  }
}

import { ErrorCode } from "@aos/common";
import { AosError, type AosErrorOptions } from "@aos/errors";

/**
 * Base class for every error this package returns-as-a-value (always inside `Result.err`, never
 * thrown for an expected/recoverable failure). Extends `@aos/errors`' `AosError`, the same
 * pattern `@aos/lead-store`'s `LeadStoreError` / `@aos/closing-tracker`'s `ClosingTrackerError`
 * establish.
 */
export class CapiError extends AosError {
  constructor(message: string, options?: AosErrorOptions & { code?: ErrorCode }) {
    super(options?.code ?? ErrorCode.VALIDATION_ERROR, message, options);
  }
}

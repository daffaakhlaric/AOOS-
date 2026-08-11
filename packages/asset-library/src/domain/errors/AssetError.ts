import { ErrorCode } from "@aos/common";
import { AosError, type AosErrorOptions } from "@aos/errors";

/**
 * Base class for every error this package returns-as-a-value (always inside `Result.err`, never
 * thrown for an expected/recoverable failure). Extends `@aos/errors`' `AosError`, mirroring
 * `@aos/lead-store`'s `LeadStoreError` pattern.
 */
export class AssetError extends AosError {
  constructor(message: string, options?: AosErrorOptions & { code?: ErrorCode }) {
    super(options?.code ?? ErrorCode.VALIDATION_ERROR, message, options);
  }
}

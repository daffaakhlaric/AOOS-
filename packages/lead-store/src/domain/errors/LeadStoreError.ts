import { ErrorCode } from "@aos/common";
import { AosError, type AosErrorOptions } from "@aos/errors";

/**
 * Base class for every error this package returns-as-a-value (always inside `Result.err`, never
 * thrown for an expected/recoverable failure). Extends `@aos/errors`' `AosError`, the same
 * pattern `@aos/branch-manager`'s `BranchManagerError` and `@aos/whatsapp-connector`'s
 * `WhatsAppConnectorError` establish.
 */
export class LeadStoreError extends AosError {
  constructor(message: string, options?: AosErrorOptions & { code?: ErrorCode }) {
    super(options?.code ?? ErrorCode.VALIDATION_ERROR, message, options);
  }
}

import type { ErrorCode } from "@aos/common";
import { AosError, type AosErrorOptions } from "@aos/errors";

/**
 * Base class for every error this package returns-as-a-value (always inside `Result.err`, never
 * thrown for an expected/recoverable failure). Extends `@aos/errors`' `AosError`, the same
 * pattern `@aos/dss-inventory-connector`'s `InventoryError` and `@aos/whatsapp-connector`'s
 * `WhatsAppConnectorError` establish.
 */
export class BranchManagerError extends AosError {
  constructor(code: ErrorCode, message: string, options?: AosErrorOptions) {
    super(code, message, options);
  }
}

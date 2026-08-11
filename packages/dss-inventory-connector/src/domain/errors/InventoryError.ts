import type { ErrorCode } from "@aos/common";
import { AosError, type AosErrorOptions } from "@aos/errors";

/**
 * Base class for every error this package returns-as-a-value (always inside `Result.err`, never
 * thrown across an async boundary for an expected/recoverable failure). Extends `@aos/errors`'
 * `AosError`, the same pattern `@aos/meta-ads-connector`'s `MetaAdsConnectorError` and
 * `@aos/whatsapp-connector`'s `WhatsAppConnectorError` establish.
 */
export class InventoryError extends AosError {
  constructor(code: ErrorCode, message: string, options?: AosErrorOptions) {
    super(code, message, options);
  }
}

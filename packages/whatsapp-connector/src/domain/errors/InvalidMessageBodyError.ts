import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { WhatsAppConnectorError } from "./WhatsAppConnectorError.js";

/**
 * Judgment call (documented in the engineering report, resolution #3): the spec's own pinned
 * Testing Requirements example ("4097 chars → InvalidMessageBodyError") requires this class to
 * exist, but the spec's "Error Hierarchy" section never lists it — an incomplete listing, not an
 * intentional omission, since the pinned test cannot pass without a concrete class. Added here as
 * a direct `WhatsAppConnectorError` subclass (same tier as `WabaNotFoundError`/
 * `InvalidPhoneNumberError`), mapped to `ErrorCode.VALIDATION_ERROR` like every other "input
 * failed validation" error in this hierarchy. Thrown-as-a-value by `MessageBody.create` when the
 * input exceeds WhatsApp Cloud API's 4096-character text-message limit.
 */
export class InvalidMessageBodyError extends WhatsAppConnectorError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.VALIDATION_ERROR, message, options);
  }
}

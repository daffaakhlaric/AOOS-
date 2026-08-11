import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { WhatsAppConnectorError } from "./WhatsAppConnectorError.js";

/** A raw string could not be normalized to a `+62` E.164 Indonesian phone number. */
export class InvalidPhoneNumberError extends WhatsAppConnectorError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.VALIDATION_ERROR, message, options);
  }
}

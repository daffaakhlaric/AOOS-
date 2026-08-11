import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { WhatsAppConnectorError } from "./WhatsAppConnectorError.js";

/** A `phone_number_id` (or `Branch`) was not found in the `WabaRegistry`. */
export class WabaNotFoundError extends WhatsAppConnectorError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.NOT_FOUND, message, options);
  }
}

import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { WhatsAppConnectorError } from "./WhatsAppConnectorError.js";

/** The `WhatsAppConnectorConfig` failed Zod validation on construction. */
export class ConnectorConfigError extends WhatsAppConnectorError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.VALIDATION_ERROR, message, options);
  }
}

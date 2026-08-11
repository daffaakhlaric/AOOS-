import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { WhatsAppApiError } from "./WhatsAppApiError.js";

/** A template message was rejected — template not approved, or parameter count/type mismatch. */
export class TemplateError extends WhatsAppApiError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(message, options, ErrorCode.VALIDATION_ERROR);
  }
}

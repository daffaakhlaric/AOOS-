import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { CapiError } from "./CapiError.js";

/** Raised when a PII field (phone/name) cannot be normalized/hashed — e.g. an empty phone string. */
export class HashingError extends CapiError {
  constructor(message: string, options?: AosErrorOptions) {
    super(message, { ...options, code: ErrorCode.VALIDATION_ERROR });
  }
}

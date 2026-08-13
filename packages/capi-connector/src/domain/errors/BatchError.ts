import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { CapiError } from "./CapiError.js";

/** Raised when a `CapiBatch` cannot be constructed — e.g. more than 1000 events. */
export class BatchError extends CapiError {
  constructor(message: string, options?: AosErrorOptions) {
    super(message, { ...options, code: ErrorCode.VALIDATION_ERROR });
  }
}

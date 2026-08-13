import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { ClosingTrackerError } from "./ClosingTrackerError.js";

/** Raised when a use case cannot produce a meaningful result because the underlying closings dataset is empty/too small (e.g. no closings at all in the requested period for a per-campaign lookup). */
export class InsufficientDataError extends ClosingTrackerError {
  constructor(message: string, options?: AosErrorOptions) {
    super(message, { ...options, code: ErrorCode.NOT_FOUND });
  }
}

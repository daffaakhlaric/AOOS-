import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { ClosingTrackerError } from "./ClosingTrackerError.js";

/** Raised when the attribution engine cannot resolve a valid attribution for a closing (e.g. an upstream `@aos/lead-store`/`ICampaignActivityProvider` call failed). */
export class AttributionError extends ClosingTrackerError {
  constructor(message: string, options?: AosErrorOptions) {
    super(message, { ...options, code: ErrorCode.INTERNAL });
  }
}

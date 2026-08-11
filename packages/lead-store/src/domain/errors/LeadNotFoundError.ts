import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { LeadStoreError } from "./LeadStoreError.js";

/** Raised when a use case looks up a lead by id (or phone+branch) and no matching row exists. */
export class LeadNotFoundError extends LeadStoreError {
  constructor(message: string, options?: AosErrorOptions) {
    super(message, { ...options, code: ErrorCode.NOT_FOUND });
  }
}

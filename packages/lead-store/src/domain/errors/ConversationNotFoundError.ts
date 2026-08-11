import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { LeadStoreError } from "./LeadStoreError.js";

/** Raised when a use case looks up a conversation by id (or by lead id) and no matching row exists. */
export class ConversationNotFoundError extends LeadStoreError {
  constructor(message: string, options?: AosErrorOptions) {
    super(message, { ...options, code: ErrorCode.NOT_FOUND });
  }
}

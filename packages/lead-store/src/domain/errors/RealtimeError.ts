import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { LeadStoreError } from "./LeadStoreError.js";

/** Raised when a Supabase Realtime channel subscription fails to establish or errors after subscribing. */
export class RealtimeError extends LeadStoreError {
  constructor(message: string, options?: AosErrorOptions) {
    super(message, { ...options, code: ErrorCode.UNAVAILABLE });
  }
}

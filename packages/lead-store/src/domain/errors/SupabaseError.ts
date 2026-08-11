import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { LeadStoreError } from "./LeadStoreError.js";

/** Wraps a failed Supabase call (a `PostgrestError`-shaped response, or a thrown client error) as a single error channel every repository returns through `Result.err`. */
export class SupabaseError extends LeadStoreError {
  constructor(message: string, options?: AosErrorOptions) {
    super(message, { ...options, code: ErrorCode.UNAVAILABLE });
  }
}

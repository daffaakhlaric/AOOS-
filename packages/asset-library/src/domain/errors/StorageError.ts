import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { AssetError } from "./AssetError.js";

/** Wraps a failed Supabase Storage or Postgrest call as a single error channel every repository/storage client returns through `Result.err`. */
export class StorageError extends AssetError {
  constructor(message: string, options?: AosErrorOptions) {
    super(message, { ...options, code: ErrorCode.UNAVAILABLE });
  }
}

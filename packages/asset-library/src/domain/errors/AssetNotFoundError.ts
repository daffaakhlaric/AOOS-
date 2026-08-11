import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { AssetError } from "./AssetError.js";

/** Raised when a use case looks up an asset by id and no matching row exists. */
export class AssetNotFoundError extends AssetError {
  constructor(message: string, options?: AosErrorOptions) {
    super(message, { ...options, code: ErrorCode.NOT_FOUND });
  }
}

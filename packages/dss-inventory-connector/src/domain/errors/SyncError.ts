import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { InventoryError } from "./InventoryError.js";

/** A whole sync run could not proceed or completed with every configured adapter failing. */
export class SyncError extends InventoryError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.UNAVAILABLE, message, options);
  }
}

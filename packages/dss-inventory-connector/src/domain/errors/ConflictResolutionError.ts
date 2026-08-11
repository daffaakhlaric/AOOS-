import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { InventoryError } from "./InventoryError.js";

/** A raw unit could not be reconciled into the domain model (failed validation/normalization during `ConflictResolutionService.resolve`/`merge`). */
export class ConflictResolutionError extends InventoryError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.CONFLICT, message, options);
  }
}

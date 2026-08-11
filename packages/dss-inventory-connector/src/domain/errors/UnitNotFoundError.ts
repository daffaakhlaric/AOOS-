import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { InventoryError } from "./InventoryError.js";

/** No `InventoryUnit` with the given `UnitId` exists in the store. */
export class UnitNotFoundError extends InventoryError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.NOT_FOUND, message, options);
  }
}

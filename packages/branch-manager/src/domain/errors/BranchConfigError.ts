import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { BranchManagerError } from "./BranchManagerError.js";

/** A `BranchConfig` mutation is invalid — e.g. `BranchRegistry.update` targeting a `BranchId` that isn't registered. */
export class BranchConfigError extends BranchManagerError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.VALIDATION_ERROR, message, options);
  }
}

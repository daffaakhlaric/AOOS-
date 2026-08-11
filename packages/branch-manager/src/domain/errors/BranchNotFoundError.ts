import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { BranchManagerError } from "./BranchManagerError.js";

/** No `BranchConfig` matches the given `BranchId` (`BranchRegistry.getByBranchId`) or `phoneNumberId` (`BranchRegistry.getByPhoneNumberId`, `DetectBranch`). */
export class BranchNotFoundError extends BranchManagerError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.NOT_FOUND, message, options);
  }
}

import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { BranchManagerError } from "./BranchManagerError.js";

/** No `SalesHuman` with the given `SalesHumanId` exists in `SalesTeamRegistry`. */
export class SalesHumanNotFoundError extends BranchManagerError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.NOT_FOUND, message, options);
  }
}

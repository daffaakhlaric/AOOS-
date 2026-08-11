import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { ObjectiveError } from "./ObjectiveError.js";

/** No stored Objective matches the requested `ObjectiveId` (and/or `tenantId`). */
export class ObjectiveNotFoundError extends ObjectiveError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.NOT_FOUND, message, options);
  }
}

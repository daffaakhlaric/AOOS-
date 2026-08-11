import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { ObjectiveError } from "./ObjectiveError.js";

/** An Objective (or a use case input describing one) failed a business-rule or Zod validation — e.g. `targetHotLeads <= 0`, a past period, or a second active objective for the same tenant/month. */
export class InvalidObjectiveError extends ObjectiveError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.VALIDATION_ERROR, message, options);
  }
}

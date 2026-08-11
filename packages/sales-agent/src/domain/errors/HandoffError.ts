import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { AgentError } from "./AgentError.js";

/** A `HandoffService`/`TriggerHandoff` failure — building the `HandoffPackage`, or the downstream `@aos/branch-manager` `AssignLead` call failing. */
export class HandoffError extends AgentError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.UNAVAILABLE, message, options);
  }
}

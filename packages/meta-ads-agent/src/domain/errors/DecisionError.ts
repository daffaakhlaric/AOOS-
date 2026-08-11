import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { AgentError } from "./AgentError.js";

/**
 * A `CampaignDecision`/`ExecutionPlan` could not be built or classified — e.g. an invalid
 * verdict/ad combination, an unclassifiable portfolio finding, or a value-object validation
 * failure surfaced from the decision engine. Mapped to `ErrorCode.VALIDATION_ERROR`: every
 * concrete cause is a bad/unexpected input to the (otherwise deterministic) decision logic,
 * never an infrastructure fault.
 */
export class DecisionError extends AgentError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.VALIDATION_ERROR, message, options);
  }
}

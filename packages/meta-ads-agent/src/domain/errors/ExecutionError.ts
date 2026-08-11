import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { AgentError } from "./AgentError.js";

/**
 * Executing an `AUTO_EXECUTE` `CampaignDecision` failed — e.g. the underlying
 * `@aos/meta-ads-connector` `ExecuteVerdict` call failed, or the decision could not be
 * translated into a valid `VerdictExecutionInput`. Mapped to `ErrorCode.UNAVAILABLE`: the
 * decision itself was valid (already `DecisionError`-checked upstream); failure here means the
 * downstream execution channel (Meta API, via the connector) could not complete the action.
 */
export class ExecutionError extends AgentError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.UNAVAILABLE, message, options);
  }
}

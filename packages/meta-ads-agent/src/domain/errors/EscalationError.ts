import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { AgentError } from "./AgentError.js";

/**
 * A human-approval-queue operation failed — e.g. `ApproveDecision`/`RejectDecision` was called
 * for an `EscalationRequest` id that doesn't exist or is no longer `PENDING`. Mapped to
 * `ErrorCode.NOT_FOUND`: the dominant real-world cause is looking up an escalation that isn't
 * (or is no longer) in the pending queue; a `CONFLICT`-shaped "already resolved" case is
 * represented with the same code plus a descriptive message, matching this package's other
 * error classes' single-code-per-class simplicity.
 */
export class EscalationError extends AgentError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.NOT_FOUND, message, options);
  }
}

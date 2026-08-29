import type { ErrorCode } from "@aos/common";
import { AosError, type AosErrorOptions } from "@aos/errors";

/**
 * Base class for every error this package returns-as-a-value (always inside `Result.err`, never
 * thrown for an expected/recoverable failure). Extends `@aos/errors`' `AosError` — the same
 * pattern `@aos/branch-manager`'s `BranchManagerError` and `@aos/dss-inventory-connector`'s
 * `InventoryError` establish. `ConversationError`, `ScoringError`, and `HandoffError` (below) are
 * the 3 more specific subclasses; `AgentError` itself is used directly for generic
 * agent-orchestration failures (e.g. `ClaraAgentService` composing a use case) that don't fit any
 * of the 3 narrower categories.
 */
export class AgentError extends AosError {
  constructor(code: ErrorCode, message: string, options?: AosErrorOptions) {
    super(code, message, options);
  }
}

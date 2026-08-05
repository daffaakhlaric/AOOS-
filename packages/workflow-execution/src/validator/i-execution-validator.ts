import type { ExecutionTimeouts } from "../context/execution-timeouts.js";
import type { ExecutionSession } from "../engine/execution-session.js";
import type { ExecutionGraph } from "../graph/execution-graph.js";
import type { RetryPolicy } from "../retry/retry-policy.js";

export interface ExecutionValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface ExecutionValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ExecutionValidationIssue[];
}

export interface ExecutionValidationInput {
  readonly session: ExecutionSession;
  readonly graph: ExecutionGraph;
  readonly retryPolicy?: RetryPolicy;
  readonly timeouts?: ExecutionTimeouts;
}

/** One stage of the Execution Validation pipeline (Graph/Transition/Node/Timeout/Retry — docs/PROMPT-005.6D-WORKFLOW-EXECUTION-ENGINE.md — "VALIDATION"). */
export interface IExecutionValidator {
  readonly name: string;
  validate(input: ExecutionValidationInput): ExecutionValidationResult;
}

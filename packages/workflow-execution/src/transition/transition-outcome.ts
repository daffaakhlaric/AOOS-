/** "TRANSITION ENGINE: Support Success, Failure, Timeout, Cancelled, Retry, Manual, Condition." (docs/PROMPT-005.6D-WORKFLOW-EXECUTION-ENGINE.md). "Condition" is resolved structurally (a `CONDITION`-kind Transition is followed unconditionally, since Expression evaluation remains out of scope in every AOS package to date — see README); "Manual" (Manual Approval) is treated the same as `success` — an approval proceeds down the normal path. */
export type TransitionOutcome =
  "success" | "failure" | "timeout" | "cancelled" | "retry" | "manual";

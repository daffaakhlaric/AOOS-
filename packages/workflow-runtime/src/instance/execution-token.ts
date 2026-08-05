const EXECUTION_TOKEN_PREFIX = "wtok_";
const EXECUTION_TOKEN_PATTERN =
  /^wtok_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Every Workflow Instance carries one unique, opaque `ExecutionToken` — `pause()`/
 * `resume()`/`cancel()`/`replay()` (`execution/workflow-execution-coordinator.ts`,
 * `runtime/workflow-runtime.ts`) address an Instance by this token alone, never by
 * scanning for a matching state. Distinct from `WorkflowInstance.id` (its stable identity)
 * — the token is the externally addressable handle for imperative operations.
 */
export type ExecutionToken = string;

/** Generates a fresh, prefixed `ExecutionToken`. */
export function generateExecutionToken(): ExecutionToken {
  return `${EXECUTION_TOKEN_PREFIX}${crypto.randomUUID()}`;
}

/** Structural validity check — does not confirm the token resolves to a live Instance. */
export function isExecutionToken(value: unknown): value is ExecutionToken {
  return typeof value === "string" && EXECUTION_TOKEN_PATTERN.test(value);
}

import type { WorkflowDefinition } from "@aos/workflow-definition";

import type { WorkflowContext } from "../context/workflow-context.js";

import type { WorkflowInstance } from "./workflow-instance.js";

/**
 * The live, in-memory aggregate the Runtime operates on — a `WorkflowInstance` (the
 * persistent envelope) paired with its `WorkflowContext` (variables/history/mode) and the
 * `WorkflowDefinition` it was created from (read-only reference, never mutated here).
 */
export interface WorkflowExecution {
  readonly definition: WorkflowDefinition;
  readonly instance: WorkflowInstance;
  readonly context: WorkflowContext;
}

/** Returns a new `WorkflowExecution` with `instance`/`context` replaced — the definition never changes across an Instance's lifetime. */
export function withExecutionState(
  execution: WorkflowExecution,
  patch: { readonly instance?: WorkflowInstance; readonly context?: WorkflowContext },
): WorkflowExecution {
  return {
    definition: execution.definition,
    instance: patch.instance ?? execution.instance,
    context: patch.context ?? execution.context,
  };
}

import { InstanceState } from "../instance/instance-state.js";

import { ExecutionMode } from "./execution-mode.js";
import type { WorkflowContext } from "./workflow-context.js";

export interface CreateWorkflowContextInput {
  readonly tenantId?: string;
  readonly correlationId: string;
  readonly traceId?: string;
  readonly workflowVariables?: Readonly<Record<string, unknown>>;
  readonly environmentVariables?: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly input?: Readonly<Record<string, unknown>>;
  readonly executionMode?: ExecutionMode;
}

/** Builds a fresh `WorkflowContext` in `InstanceState.CREATED` with empty Execution/Node variables and history — the starting point `runtime/workflow-runtime.ts#createInstance()` hands to a new Instance. */
export function createWorkflowContext(input: CreateWorkflowContextInput): WorkflowContext {
  return {
    tenantId: input.tenantId,
    correlationId: input.correlationId,
    traceId: input.traceId,
    workflowVariables: { ...(input.workflowVariables ?? {}) },
    environmentVariables: { ...(input.environmentVariables ?? {}) },
    executionVariables: {},
    nodeVariables: {},
    metadata: input.metadata ? { ...input.metadata } : undefined,
    input: input.input ? { ...input.input } : undefined,
    output: undefined,
    executionMode: input.executionMode ?? ExecutionMode.NORMAL,
    currentState: InstanceState.CREATED,
    executionHistory: [],
  };
}

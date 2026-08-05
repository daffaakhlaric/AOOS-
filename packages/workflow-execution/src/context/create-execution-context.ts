import { ExecutionState } from "../state-machine/execution-state.js";
import type { ExecutionToken } from "../token/execution-token.js";

import type { ExecutionContext } from "./execution-context.js";
import { ExecutionMode } from "./execution-mode.js";

export interface CreateExecutionContextInput {
  readonly token: ExecutionToken;
  readonly mode?: ExecutionMode;
  readonly workflowVariables?: Readonly<Record<string, unknown>>;
  readonly environmentVariables?: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Builds a fresh `ExecutionContext` in `ExecutionState.CREATED`, `ExecutionMode.SEQUENTIAL` by default. */
export function createExecutionContext(input: CreateExecutionContextInput): ExecutionContext {
  return {
    token: input.token,
    mode: input.mode ?? ExecutionMode.SEQUENTIAL,
    currentState: ExecutionState.CREATED,
    workflowVariables: { ...(input.workflowVariables ?? {}) },
    environmentVariables: { ...(input.environmentVariables ?? {}) },
    executionVariables: {},
    metadata: input.metadata ? { ...input.metadata } : undefined,
  };
}

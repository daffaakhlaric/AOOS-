import { generateId } from "../utils/id.js";

import type { ExecutionToken } from "./execution-token.js";

export interface CreateExecutionTokenInput {
  readonly tenantId?: string;
  readonly workflowInstanceId: string;
  readonly traceId?: string;
  readonly correlationId?: string;
  readonly startedAt?: string;
}

/** Builds a fresh, immutable `ExecutionToken` — one per `WorkflowExecutionEngine#executeWorkflow()` call. */
export function createExecutionToken(input: CreateExecutionTokenInput): ExecutionToken {
  return {
    workflowExecutionId: generateId(),
    tenantId: input.tenantId,
    workflowInstanceId: input.workflowInstanceId,
    executionId: generateId(),
    startedAt: input.startedAt ?? new Date().toISOString(),
    traceId: input.traceId,
    correlationId: input.correlationId ?? generateId(),
  };
}

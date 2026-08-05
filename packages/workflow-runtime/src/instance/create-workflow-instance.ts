import { generateId } from "../utils/id.js";

import { generateExecutionToken } from "./execution-token.js";
import { InstanceState } from "./instance-state.js";
import type { WorkflowInstanceMetadata } from "./workflow-instance-metadata.js";
import type { WorkflowInstance } from "./workflow-instance.js";

export interface CreateWorkflowInstanceInput {
  readonly workflowId: string;
  readonly workflowVersion: string;
  readonly tenantId?: string;
  readonly metadata?: WorkflowInstanceMetadata;
}

/** Builds a fresh `WorkflowInstance` in `InstanceState.CREATED`, with a freshly generated `id` and `ExecutionToken`. */
export function createWorkflowInstance(input: CreateWorkflowInstanceInput): WorkflowInstance {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    token: generateExecutionToken(),
    workflowId: input.workflowId,
    workflowVersion: input.workflowVersion,
    tenantId: input.tenantId,
    status: InstanceState.CREATED,
    executionPointer: {},
    metadata: input.metadata ?? {},
    createdAt: now,
    updatedAt: now,
  };
}

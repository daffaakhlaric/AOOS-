import type { ExecutionToken } from "@aos/workflow-execution";

import type { WorkflowIntegrationContext } from "./workflow-integration-context.js";

export interface CreateWorkflowIntegrationContextInput {
  readonly token: ExecutionToken;
  readonly workflowId: string;
  readonly userId?: string;
  readonly environment?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly variables?: Readonly<Record<string, unknown>>;
}

/** Builds a fresh `WorkflowIntegrationContext` from an `ExecutionToken` — `workflowInstanceId`/`executionId`/`tenantId`/`correlationId`/`traceId` are all read straight off the token, since one Integration Context always corresponds to exactly one Workflow Execution. */
export function createWorkflowIntegrationContext(
  input: CreateWorkflowIntegrationContextInput,
): WorkflowIntegrationContext {
  return {
    token: input.token,
    workflowId: input.workflowId,
    workflowInstanceId: input.token.workflowInstanceId,
    executionId: input.token.executionId,
    tenantId: input.token.tenantId,
    userId: input.userId,
    environment: input.environment,
    correlationId: input.token.correlationId,
    traceId: input.token.traceId,
    metadata: { ...input.metadata },
    variables: { ...input.variables },
  };
}

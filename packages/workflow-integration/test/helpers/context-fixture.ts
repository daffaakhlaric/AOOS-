import { createExecutionToken } from "@aos/workflow-execution";

import { createWorkflowIntegrationContext } from "../../src/context/create-workflow-integration-context.js";
import type { WorkflowIntegrationContext } from "../../src/context/workflow-integration-context.js";

export function contextFixture(
  overrides: {
    readonly workflowId?: string;
    readonly tenantId?: string;
    readonly userId?: string;
    readonly environment?: string;
    readonly correlationId?: string;
  } = {},
): WorkflowIntegrationContext {
  const token = createExecutionToken({
    workflowInstanceId: "wf-instance-1",
    tenantId: overrides.tenantId,
    correlationId: overrides.correlationId,
  });
  return createWorkflowIntegrationContext({
    token,
    workflowId: overrides.workflowId ?? "sample-workflow",
    userId: overrides.userId,
    environment: overrides.environment,
  });
}

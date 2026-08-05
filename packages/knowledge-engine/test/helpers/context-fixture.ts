import { createExecutionToken } from "@aos/workflow-execution";

import { createKnowledgeContext } from "../../src/context/create-knowledge-context.js";
import type { KnowledgeContext } from "../../src/context/knowledge-context.js";

export function contextFixture(
  overrides: {
    readonly tenantId?: string;
    readonly workspaceId?: string;
    readonly departmentId?: string;
    readonly userId?: string;
    readonly environment?: string;
    readonly permissions?: readonly string[];
  } = {},
): KnowledgeContext {
  const token = createExecutionToken({ workflowInstanceId: "wf-instance-1" });
  return createKnowledgeContext({
    token,
    tenantId: overrides.tenantId ?? "tenant-1",
    workspaceId: overrides.workspaceId,
    departmentId: overrides.departmentId,
    userId: overrides.userId,
    environment: overrides.environment,
    permissions: overrides.permissions,
  });
}

import { createExecutionToken } from "@aos/workflow-execution";
import { describe, expect, it } from "vitest";

import { createWorkflowIntegrationContext } from "../../src/context/create-workflow-integration-context.js";

describe("Context Test — createWorkflowIntegrationContext", () => {
  it("derives workflowInstanceId/executionId/tenantId/correlationId/traceId straight from the ExecutionToken", () => {
    const token = createExecutionToken({
      workflowInstanceId: "wf-instance-1",
      tenantId: "tenant-1",
      traceId: "trace-1",
      correlationId: "corr-1",
    });
    const context = createWorkflowIntegrationContext({ token, workflowId: "wf-1" });

    expect(context.workflowInstanceId).toBe("wf-instance-1");
    expect(context.executionId).toBe(token.executionId);
    expect(context.tenantId).toBe("tenant-1");
    expect(context.traceId).toBe("trace-1");
    expect(context.correlationId).toBe("corr-1");
    expect(context.workflowId).toBe("wf-1");
  });

  it("defaults metadata/variables to independent empty objects", () => {
    const tokenA = createExecutionToken({ workflowInstanceId: "wf-instance-1" });
    const tokenB = createExecutionToken({ workflowInstanceId: "wf-instance-2" });
    const a = createWorkflowIntegrationContext({ token: tokenA, workflowId: "wf-1" });
    const b = createWorkflowIntegrationContext({ token: tokenB, workflowId: "wf-2" });
    a.metadata["mutated"] = true;
    expect(b.metadata).toEqual({});
  });

  it("carries through userId/environment/metadata/variables when supplied", () => {
    const token = createExecutionToken({ workflowInstanceId: "wf-instance-1" });
    const context = createWorkflowIntegrationContext({
      token,
      workflowId: "wf-1",
      userId: "user-1",
      environment: "production",
      metadata: { owner: "team-x" },
      variables: { count: 3 },
    });
    expect(context.userId).toBe("user-1");
    expect(context.environment).toBe("production");
    expect(context.metadata).toEqual({ owner: "team-x" });
    expect(context.variables).toEqual({ count: 3 });
  });

  it("leaves every Result slot undefined initially", () => {
    const token = createExecutionToken({ workflowInstanceId: "wf-instance-1" });
    const context = createWorkflowIntegrationContext({ token, workflowId: "wf-1" });
    expect(context.capabilityResult).toBeUndefined();
    expect(context.toolResult).toBeUndefined();
    expect(context.connectorResult).toBeUndefined();
    expect(context.knowledgeResult).toBeUndefined();
    expect(context.memoryResult).toBeUndefined();
    expect(context.promptResult).toBeUndefined();
    expect(context.modelResult).toBeUndefined();
    expect(context.agentResult).toBeUndefined();
  });
});

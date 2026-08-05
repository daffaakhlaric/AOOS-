import { describe, expect, it } from "vitest";

import { createWorkflowInstance } from "../../src/instance/create-workflow-instance.js";
import { isExecutionToken } from "../../src/instance/execution-token.js";
import { InstanceState } from "../../src/instance/instance-state.js";

describe("createWorkflowInstance", () => {
  it("creates a fresh Instance in CREATED state with a unique id and ExecutionToken", () => {
    const instance = createWorkflowInstance({ workflowId: "wf-1", workflowVersion: "1.0.0" });
    expect(instance.status).toBe(InstanceState.CREATED);
    expect(instance.workflowId).toBe("wf-1");
    expect(instance.workflowVersion).toBe("1.0.0");
    expect(isExecutionToken(instance.token)).toBe(true);
    expect(instance.id).toBeTruthy();
    expect(instance.metadata).toEqual({});
    expect(instance.createdAt).toBe(instance.updatedAt);
  });

  it("generates distinct id/token per call", () => {
    const a = createWorkflowInstance({ workflowId: "wf-1", workflowVersion: "1.0.0" });
    const b = createWorkflowInstance({ workflowId: "wf-1", workflowVersion: "1.0.0" });
    expect(a.id).not.toBe(b.id);
    expect(a.token).not.toBe(b.token);
  });

  it("carries through tenantId and metadata when supplied", () => {
    const instance = createWorkflowInstance({
      workflowId: "wf-1",
      workflowVersion: "1.0.0",
      tenantId: "tenant-a",
      metadata: { owner: "team-x" },
    });
    expect(instance.tenantId).toBe("tenant-a");
    expect(instance.metadata).toEqual({ owner: "team-x" });
  });
});

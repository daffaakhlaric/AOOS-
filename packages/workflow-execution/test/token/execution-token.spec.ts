import { describe, expect, it } from "vitest";

import { createExecutionToken } from "../../src/token/create-execution-token.js";
import { executionTokenSchema } from "../../src/token/execution-token.js";

describe("Token Test — ExecutionToken", () => {
  it("createExecutionToken() builds a fully-formed, schema-valid token", () => {
    const token = createExecutionToken({ workflowInstanceId: "wf-instance-1" });
    expect(executionTokenSchema.safeParse(token).success).toBe(true);
    expect(token.workflowInstanceId).toBe("wf-instance-1");
    expect(token.workflowExecutionId).toBeTruthy();
    expect(token.executionId).toBeTruthy();
    expect(token.correlationId).toBeTruthy();
  });

  it("generates distinct workflowExecutionId/executionId per call", () => {
    const a = createExecutionToken({ workflowInstanceId: "wf-1" });
    const b = createExecutionToken({ workflowInstanceId: "wf-1" });
    expect(a.workflowExecutionId).not.toBe(b.workflowExecutionId);
    expect(a.executionId).not.toBe(b.executionId);
  });

  it("carries through tenantId/traceId/correlationId/startedAt when supplied", () => {
    const token = createExecutionToken({
      tenantId: "tenant-a",
      workflowInstanceId: "wf-1",
      traceId: "trace-1",
      correlationId: "corr-1",
      startedAt: "2020-01-01T00:00:00.000Z",
    });
    expect(token.tenantId).toBe("tenant-a");
    expect(token.traceId).toBe("trace-1");
    expect(token.correlationId).toBe("corr-1");
    expect(token.startedAt).toBe("2020-01-01T00:00:00.000Z");
  });

  it("executionTokenSchema rejects a missing required field", () => {
    expect(executionTokenSchema.safeParse({ workflowExecutionId: "x" }).success).toBe(false);
  });
});

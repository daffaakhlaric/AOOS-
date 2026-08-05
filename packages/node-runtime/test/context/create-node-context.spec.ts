import { describe, expect, it } from "vitest";

import { createNodeContext } from "../../src/context/create-node-context.js";
import { ExecutionMode } from "../../src/contracts/execution-mode.js";

describe("createNodeContext", () => {
  it("creates a fresh Context with a generated executionId and NORMAL mode by default", () => {
    const context = createNodeContext({ workflowInstanceId: "wf-1", nodeId: "n-1" });
    expect(context.workflowInstanceId).toBe("wf-1");
    expect(context.nodeId).toBe("n-1");
    expect(context.executionId).toBeTruthy();
    expect(context.correlationId).toBeTruthy();
    expect(context.executionMode).toBe(ExecutionMode.NORMAL);
    expect(context.variables).toEqual({});
  });

  it("carries through tenant/trace/correlation/variables/input/metadata/executionMode when supplied", () => {
    const context = createNodeContext({
      tenantId: "tenant-a",
      workflowInstanceId: "wf-1",
      nodeId: "n-1",
      traceId: "trace-1",
      correlationId: "corr-1",
      input: { a: 1 },
      variables: { b: 2 },
      metadata: { c: 3 },
      executionMode: ExecutionMode.SIMULATION,
    });
    expect(context.tenantId).toBe("tenant-a");
    expect(context.traceId).toBe("trace-1");
    expect(context.correlationId).toBe("corr-1");
    expect(context.input).toEqual({ a: 1 });
    expect(context.variables).toEqual({ b: 2 });
    expect(context.metadata).toEqual({ c: 3 });
    expect(context.executionMode).toBe(ExecutionMode.SIMULATION);
  });

  it("generates distinct executionIds per call, and independent variable objects", () => {
    const a = createNodeContext({ workflowInstanceId: "wf-1", nodeId: "n-1" });
    const b = createNodeContext({ workflowInstanceId: "wf-1", nodeId: "n-1" });
    expect(a.executionId).not.toBe(b.executionId);
    a.variables["mutated"] = true;
    expect(b.variables).toEqual({});
  });
});

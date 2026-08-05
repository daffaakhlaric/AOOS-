import { describe, expect, it } from "vitest";

import { createWorkflowContext } from "../../src/context/create-workflow-context.js";
import { ExecutionMode } from "../../src/context/execution-mode.js";
import { InstanceState } from "../../src/instance/instance-state.js";

describe("createWorkflowContext", () => {
  it("creates a fresh Context in CREATED state, NORMAL mode, with empty history", () => {
    const context = createWorkflowContext({ correlationId: "corr-1" });
    expect(context.currentState).toBe(InstanceState.CREATED);
    expect(context.executionMode).toBe(ExecutionMode.NORMAL);
    expect(context.executionHistory).toEqual([]);
    expect(context.executionVariables).toEqual({});
    expect(context.nodeVariables).toEqual({});
  });

  it("carries through tenant/trace/variables/input/executionMode when supplied", () => {
    const context = createWorkflowContext({
      correlationId: "corr-1",
      tenantId: "tenant-a",
      traceId: "trace-1",
      workflowVariables: { a: 1 },
      environmentVariables: { env: "prod" },
      metadata: { m: true },
      input: { in: "x" },
      executionMode: ExecutionMode.SIMULATION,
    });
    expect(context.tenantId).toBe("tenant-a");
    expect(context.traceId).toBe("trace-1");
    expect(context.workflowVariables).toEqual({ a: 1 });
    expect(context.environmentVariables).toEqual({ env: "prod" });
    expect(context.metadata).toEqual({ m: true });
    expect(context.input).toEqual({ in: "x" });
    expect(context.executionMode).toBe(ExecutionMode.SIMULATION);
  });

  it("defaults workflowVariables/environmentVariables to independent empty objects", () => {
    const a = createWorkflowContext({ correlationId: "corr-1" });
    const b = createWorkflowContext({ correlationId: "corr-2" });
    a.workflowVariables["mutated"] = true;
    expect(b.workflowVariables).toEqual({});
  });
});

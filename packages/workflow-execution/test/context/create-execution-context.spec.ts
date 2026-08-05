import { describe, expect, it } from "vitest";

import { createExecutionContext } from "../../src/context/create-execution-context.js";
import { ExecutionMode } from "../../src/context/execution-mode.js";
import { ExecutionState } from "../../src/state-machine/execution-state.js";
import { createExecutionToken } from "../../src/token/create-execution-token.js";

describe("Context Test — createExecutionContext", () => {
  it("creates a fresh Context in CREATED state, SEQUENTIAL mode by default", () => {
    const token = createExecutionToken({ workflowInstanceId: "wf-1" });
    const context = createExecutionContext({ token });
    expect(context.currentState).toBe(ExecutionState.CREATED);
    expect(context.mode).toBe(ExecutionMode.SEQUENTIAL);
    expect(context.workflowVariables).toEqual({});
    expect(context.environmentVariables).toEqual({});
    expect(context.executionVariables).toEqual({});
  });

  it("carries through mode/variables/metadata when supplied", () => {
    const token = createExecutionToken({ workflowInstanceId: "wf-1" });
    const context = createExecutionContext({
      token,
      mode: ExecutionMode.PARALLEL,
      workflowVariables: { a: 1 },
      environmentVariables: { env: "prod" },
      metadata: { owner: "team-x" },
    });
    expect(context.mode).toBe(ExecutionMode.PARALLEL);
    expect(context.workflowVariables).toEqual({ a: 1 });
    expect(context.environmentVariables).toEqual({ env: "prod" });
    expect(context.metadata).toEqual({ owner: "team-x" });
  });

  it("defaults workflowVariables/environmentVariables to independent empty objects", () => {
    const tokenA = createExecutionToken({ workflowInstanceId: "wf-1" });
    const tokenB = createExecutionToken({ workflowInstanceId: "wf-2" });
    const a = createExecutionContext({ token: tokenA });
    const b = createExecutionContext({ token: tokenB });
    a.workflowVariables["mutated"] = true;
    expect(b.workflowVariables).toEqual({});
  });
});

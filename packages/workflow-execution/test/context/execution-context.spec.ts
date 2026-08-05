import { describe, expect, it } from "vitest";

import { executionContextSchema } from "../../src/context/execution-context.js";
import { ExecutionMode } from "../../src/context/execution-mode.js";
import { ExecutionState } from "../../src/state-machine/execution-state.js";
import { createExecutionToken } from "../../src/token/create-execution-token.js";

describe("executionContextSchema", () => {
  it("accepts a minimal valid Context", () => {
    const token = createExecutionToken({ workflowInstanceId: "wf-1" });
    const result = executionContextSchema.safeParse({
      token,
      mode: ExecutionMode.SEQUENTIAL,
      currentState: ExecutionState.CREATED,
      workflowVariables: {},
      environmentVariables: {},
      executionVariables: {},
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid mode", () => {
    const token = createExecutionToken({ workflowInstanceId: "wf-1" });
    const result = executionContextSchema.safeParse({
      token,
      mode: "not-a-mode",
      currentState: ExecutionState.CREATED,
      workflowVariables: {},
      environmentVariables: {},
      executionVariables: {},
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing token", () => {
    const result = executionContextSchema.safeParse({
      mode: ExecutionMode.SEQUENTIAL,
      currentState: ExecutionState.CREATED,
      workflowVariables: {},
      environmentVariables: {},
      executionVariables: {},
    });
    expect(result.success).toBe(false);
  });
});

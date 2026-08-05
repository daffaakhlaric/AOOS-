import { describe, expect, it } from "vitest";

import { ExecutionMode } from "../../src/context/execution-mode.js";
import { workflowContextSchema } from "../../src/context/workflow-context.js";
import { InstanceState } from "../../src/instance/instance-state.js";

describe("workflowContextSchema", () => {
  it("accepts a minimal valid Context", () => {
    const result = workflowContextSchema.safeParse({
      correlationId: "corr-1",
      workflowVariables: {},
      environmentVariables: {},
      executionVariables: {},
      nodeVariables: {},
      executionMode: ExecutionMode.NORMAL,
      currentState: InstanceState.CREATED,
      executionHistory: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing correlationId", () => {
    const result = workflowContextSchema.safeParse({
      workflowVariables: {},
      environmentVariables: {},
      executionVariables: {},
      nodeVariables: {},
      executionMode: ExecutionMode.NORMAL,
      currentState: InstanceState.CREATED,
      executionHistory: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid executionMode", () => {
    const result = workflowContextSchema.safeParse({
      correlationId: "corr-1",
      workflowVariables: {},
      environmentVariables: {},
      executionVariables: {},
      nodeVariables: {},
      executionMode: "not-a-mode",
      currentState: InstanceState.CREATED,
      executionHistory: [],
    });
    expect(result.success).toBe(false);
  });
});

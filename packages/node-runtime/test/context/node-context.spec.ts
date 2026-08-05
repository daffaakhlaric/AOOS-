import { describe, expect, it } from "vitest";

import { nodeContextSchema } from "../../src/context/node-context.js";
import { ExecutionMode } from "../../src/contracts/execution-mode.js";

describe("nodeContextSchema", () => {
  it("accepts a minimal valid Context", () => {
    const result = nodeContextSchema.safeParse({
      workflowInstanceId: "wf-1",
      nodeId: "n-1",
      executionId: "e-1",
      correlationId: "c-1",
      variables: {},
      executionMode: ExecutionMode.NORMAL,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing correlationId", () => {
    const result = nodeContextSchema.safeParse({
      workflowInstanceId: "wf-1",
      nodeId: "n-1",
      executionId: "e-1",
      variables: {},
      executionMode: ExecutionMode.NORMAL,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid executionMode", () => {
    const result = nodeContextSchema.safeParse({
      workflowInstanceId: "wf-1",
      nodeId: "n-1",
      executionId: "e-1",
      correlationId: "c-1",
      variables: {},
      executionMode: "not-a-mode",
    });
    expect(result.success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { NodeState } from "../../src/contracts/node-state.js";
import { withNodeExecutionState } from "../../src/instance/node-execution.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("withNodeExecutionState", () => {
  it("replaces instance/context/history while keeping the same manifest", () => {
    const execution = executionFixture();
    const patchedInstance = { ...execution.instance, status: NodeState.READY };
    const result = withNodeExecutionState(execution, { instance: patchedInstance });
    expect(result.manifest).toBe(execution.manifest);
    expect(result.instance).toBe(patchedInstance);
    expect(result.context).toBe(execution.context);
    expect(result.history).toBe(execution.history);
  });

  it("returns the same fields when no patch is given for them", () => {
    const execution = executionFixture();
    const result = withNodeExecutionState(execution, {});
    expect(result).toEqual(execution);
  });
});

import { describe, expect, it } from "vitest";

import { InstanceState } from "../../src/instance/instance-state.js";
import { withExecutionState } from "../../src/instance/workflow-execution.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("withExecutionState", () => {
  it("replaces instance and/or context while keeping the same definition", () => {
    const execution = executionFixture();
    const patchedInstance = { ...execution.instance, status: InstanceState.READY };
    const result = withExecutionState(execution, { instance: patchedInstance });
    expect(result.definition).toBe(execution.definition);
    expect(result.instance).toBe(patchedInstance);
    expect(result.context).toBe(execution.context);
  });

  it("returns the same instance/context when no patch is given for them", () => {
    const execution = executionFixture();
    const result = withExecutionState(execution, {});
    expect(result).toEqual(execution);
  });
});

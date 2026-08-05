import { describe, expect, it } from "vitest";

import { IllegalTransitionException } from "../../src/errors/illegal-transition-exception.js";
import { InstanceState } from "../../src/instance/instance-state.js";
import { WorkflowStateMachine } from "../../src/state-machine/workflow-state-machine.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("State Machine Test — WorkflowStateMachine", () => {
  it("canTransition() reflects INSTANCE_STATE_TRANSITIONS", () => {
    const machine = new WorkflowStateMachine();
    expect(machine.canTransition(InstanceState.CREATED, InstanceState.READY)).toBe(true);
    expect(machine.canTransition(InstanceState.CREATED, InstanceState.COMPLETED)).toBe(false);
  });

  it("transition() applies a legal transition and appends a history entry", () => {
    const machine = new WorkflowStateMachine();
    const execution = executionFixture({ status: InstanceState.CREATED });
    const result = machine.transition({ execution, to: InstanceState.READY, reason: "go" });
    expect(result.instance.status).toBe(InstanceState.READY);
    expect(result.context.currentState).toBe(InstanceState.READY);
    expect(result.instance.updatedAt).not.toBe(execution.instance.updatedAt);
    expect(result.context.executionHistory).toHaveLength(1);
    expect(result.context.executionHistory[0]).toMatchObject({
      fromState: InstanceState.CREATED,
      toState: InstanceState.READY,
      reason: "go",
    });
  });

  it("transition() throws IllegalTransitionException for an illegal transition", () => {
    const machine = new WorkflowStateMachine();
    const execution = executionFixture({ status: InstanceState.CREATED });
    expect(() => machine.transition({ execution, to: InstanceState.COMPLETED })).toThrow(
      IllegalTransitionException,
    );
  });

  it("appends multiple history entries with increasing sequence numbers", () => {
    const machine = new WorkflowStateMachine();
    let execution = executionFixture({ status: InstanceState.CREATED });
    execution = machine.transition({ execution, to: InstanceState.READY });
    execution = machine.transition({ execution, to: InstanceState.RUNNING });
    expect(execution.context.executionHistory.map((entry) => entry.sequence)).toEqual([0, 1]);
  });
});

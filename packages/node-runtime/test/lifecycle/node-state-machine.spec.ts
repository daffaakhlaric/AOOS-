import { describe, expect, it } from "vitest";

import { NodeState } from "../../src/contracts/node-state.js";
import { IllegalNodeTransitionException } from "../../src/errors/illegal-node-transition-exception.js";
import { NodeStateMachine } from "../../src/lifecycle/node-state-machine.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("Node State Machine Test — NodeStateMachine", () => {
  it("canTransition() reflects NODE_STATE_TRANSITIONS", () => {
    const machine = new NodeStateMachine();
    expect(machine.canTransition(NodeState.CREATED, NodeState.READY)).toBe(true);
    expect(machine.canTransition(NodeState.CREATED, NodeState.COMPLETED)).toBe(false);
  });

  it("transition() applies a legal transition and appends a history entry", () => {
    const machine = new NodeStateMachine();
    const execution = executionFixture({ status: NodeState.CREATED });
    const result = machine.transition({ execution, to: NodeState.READY, reason: "go" });
    expect(result.instance.status).toBe(NodeState.READY);
    expect(result.instance.updatedAt).not.toBe(execution.instance.updatedAt);
    expect(result.history).toHaveLength(1);
    expect(result.history[0]).toMatchObject({
      fromState: NodeState.CREATED,
      toState: NodeState.READY,
      reason: "go",
    });
  });

  it("transition() throws IllegalNodeTransitionException for an illegal transition", () => {
    const machine = new NodeStateMachine();
    const execution = executionFixture({ status: NodeState.CREATED });
    expect(() => machine.transition({ execution, to: NodeState.COMPLETED })).toThrow(
      IllegalNodeTransitionException,
    );
  });

  it("appends multiple history entries with increasing sequence numbers", () => {
    const machine = new NodeStateMachine();
    let execution = executionFixture({ status: NodeState.CREATED });
    execution = machine.transition({ execution, to: NodeState.READY });
    execution = machine.transition({ execution, to: NodeState.RUNNING });
    expect(execution.history.map((entry) => entry.sequence)).toEqual([0, 1]);
  });
});

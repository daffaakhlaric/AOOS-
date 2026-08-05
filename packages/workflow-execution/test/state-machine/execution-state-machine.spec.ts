import { describe, expect, it } from "vitest";

import { IllegalExecutionTransitionException } from "../../src/errors/illegal-execution-transition-exception.js";
import { ExecutionStateMachine } from "../../src/state-machine/execution-state-machine.js";
import { ExecutionState } from "../../src/state-machine/execution-state.js";
import { sessionFixture } from "../helpers/session-fixture.js";

describe("State Machine Test — ExecutionStateMachine", () => {
  it("canTransition() reflects EXECUTION_STATE_TRANSITIONS", () => {
    const machine = new ExecutionStateMachine();
    expect(machine.canTransition(ExecutionState.CREATED, ExecutionState.READY)).toBe(true);
    expect(machine.canTransition(ExecutionState.CREATED, ExecutionState.COMPLETED)).toBe(false);
  });

  it("transition() applies a legal transition and appends a history entry", () => {
    const machine = new ExecutionStateMachine();
    const { session } = sessionFixture({ currentState: ExecutionState.CREATED });
    const result = machine.transition({
      session,
      to: ExecutionState.READY,
      reason: "go",
      nodeId: "start",
    });
    expect(result.context.currentState).toBe(ExecutionState.READY);
    expect(result.history).toHaveLength(1);
    expect(result.history[0]).toMatchObject({
      fromState: ExecutionState.CREATED,
      toState: ExecutionState.READY,
      reason: "go",
      nodeId: "start",
    });
  });

  it("transition() throws IllegalExecutionTransitionException for an illegal transition", () => {
    const machine = new ExecutionStateMachine();
    const { session } = sessionFixture({ currentState: ExecutionState.CREATED });
    expect(() => machine.transition({ session, to: ExecutionState.COMPLETED })).toThrow(
      IllegalExecutionTransitionException,
    );
  });

  it("appends multiple history entries with increasing sequence numbers", () => {
    const machine = new ExecutionStateMachine();
    let { session } = sessionFixture({ currentState: ExecutionState.CREATED });
    session = machine.transition({ session, to: ExecutionState.READY });
    session = machine.transition({ session, to: ExecutionState.RUNNING });
    expect(session.history.map((entry) => entry.sequence)).toEqual([0, 1]);
  });
});

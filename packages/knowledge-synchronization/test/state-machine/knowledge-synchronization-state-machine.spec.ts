import { describe, expect, it } from "vitest";

import { KnowledgeSynchronizationState } from "../../src/domain/knowledge-synchronization-state.js";
import { IllegalSynchronizationTransitionException } from "../../src/errors/illegal-synchronization-transition-exception.js";
import { KnowledgeSynchronizationStateMachine } from "../../src/state-machine/knowledge-synchronization-state-machine.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("KnowledgeSynchronizationStateMachine", () => {
  it("allows a legal transition", () => {
    const machine = new KnowledgeSynchronizationStateMachine();
    expect(
      machine.canTransition(
        KnowledgeSynchronizationState.CREATED,
        KnowledgeSynchronizationState.QUEUED,
      ),
    ).toBe(true);
  });

  it("disallows an illegal transition", () => {
    const machine = new KnowledgeSynchronizationStateMachine();
    expect(
      machine.canTransition(
        KnowledgeSynchronizationState.CREATED,
        KnowledgeSynchronizationState.COMPLETED,
      ),
    ).toBe(false);
  });

  it("transitions an execution and appends a history entry", () => {
    const machine = new KnowledgeSynchronizationStateMachine();
    const execution = executionFixture();
    const next = machine.transition({ execution, to: KnowledgeSynchronizationState.QUEUED });
    expect(next.instance.state).toBe(KnowledgeSynchronizationState.QUEUED);
    expect(next.history).toHaveLength(1);
    expect(next.history[0]).toMatchObject({
      sequence: 0,
      fromState: KnowledgeSynchronizationState.CREATED,
      toState: KnowledgeSynchronizationState.QUEUED,
    });
  });

  it("records the reason when supplied", () => {
    const machine = new KnowledgeSynchronizationStateMachine();
    const execution = executionFixture();
    const next = machine.transition({
      execution,
      to: KnowledgeSynchronizationState.CANCELLED,
      reason: "user cancelled",
    });
    expect(next.history[0]?.reason).toBe("user cancelled");
  });

  it("throws IllegalSynchronizationTransitionException for an illegal transition", () => {
    const machine = new KnowledgeSynchronizationStateMachine();
    const execution = executionFixture();
    expect(() =>
      machine.transition({ execution, to: KnowledgeSynchronizationState.COMPLETED }),
    ).toThrow(IllegalSynchronizationTransitionException);
  });

  it("never allows a transition out of DESTROYED", () => {
    const machine = new KnowledgeSynchronizationStateMachine();
    const execution = executionFixture({
      instance: { ...executionFixture().instance, state: KnowledgeSynchronizationState.DESTROYED },
    });
    expect(() =>
      machine.transition({ execution, to: KnowledgeSynchronizationState.QUEUED }),
    ).toThrow(IllegalSynchronizationTransitionException);
  });

  it("allows COMPLETED to transition to DESTROYED", () => {
    const machine = new KnowledgeSynchronizationStateMachine();
    const execution = executionFixture({
      instance: { ...executionFixture().instance, state: KnowledgeSynchronizationState.COMPLETED },
    });
    const next = machine.transition({ execution, to: KnowledgeSynchronizationState.DESTROYED });
    expect(next.instance.state).toBe(KnowledgeSynchronizationState.DESTROYED);
  });
});

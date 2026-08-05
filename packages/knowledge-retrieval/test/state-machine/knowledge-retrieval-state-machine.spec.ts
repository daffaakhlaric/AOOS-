import { describe, expect, it } from "vitest";

import { KnowledgeRetrievalState } from "../../src/domain/knowledge-retrieval-state.js";
import { IllegalRetrievalTransitionException } from "../../src/errors/illegal-retrieval-transition-exception.js";
import { KnowledgeRetrievalStateMachine } from "../../src/state-machine/knowledge-retrieval-state-machine.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("KnowledgeRetrievalStateMachine", () => {
  it("allows a legal transition", () => {
    const machine = new KnowledgeRetrievalStateMachine();
    expect(
      machine.canTransition(KnowledgeRetrievalState.CREATED, KnowledgeRetrievalState.VALIDATING),
    ).toBe(true);
  });

  it("disallows an illegal transition", () => {
    const machine = new KnowledgeRetrievalStateMachine();
    expect(
      machine.canTransition(KnowledgeRetrievalState.CREATED, KnowledgeRetrievalState.COMPLETED),
    ).toBe(false);
  });

  it("transitions an execution and appends a history entry", () => {
    const machine = new KnowledgeRetrievalStateMachine();
    const execution = executionFixture();
    const next = machine.transition({ execution, to: KnowledgeRetrievalState.VALIDATING });
    expect(next.instance.state).toBe(KnowledgeRetrievalState.VALIDATING);
    expect(next.history).toHaveLength(1);
    expect(next.history[0]).toMatchObject({
      sequence: 0,
      fromState: KnowledgeRetrievalState.CREATED,
      toState: KnowledgeRetrievalState.VALIDATING,
    });
  });

  it("records the reason when supplied", () => {
    const machine = new KnowledgeRetrievalStateMachine();
    const execution = executionFixture();
    const next = machine.transition({
      execution,
      to: KnowledgeRetrievalState.CANCELLED,
      reason: "user cancelled",
    });
    expect(next.history[0]?.reason).toBe("user cancelled");
  });

  it("throws IllegalRetrievalTransitionException for an illegal transition", () => {
    const machine = new KnowledgeRetrievalStateMachine();
    const execution = executionFixture();
    expect(() => machine.transition({ execution, to: KnowledgeRetrievalState.COMPLETED })).toThrow(
      IllegalRetrievalTransitionException,
    );
  });

  it("never allows a transition out of a terminal state", () => {
    const machine = new KnowledgeRetrievalStateMachine();
    const execution = executionFixture({
      instance: { ...executionFixture().instance, state: KnowledgeRetrievalState.COMPLETED },
    });
    expect(() => machine.transition({ execution, to: KnowledgeRetrievalState.VALIDATING })).toThrow(
      IllegalRetrievalTransitionException,
    );
  });
});

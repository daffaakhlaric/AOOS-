import { describe, expect, it } from "vitest";

import { KnowledgePolicyState } from "../../src/domain/knowledge-policy-state.js";
import { IllegalPolicyTransitionException } from "../../src/errors/illegal-policy-transition-exception.js";
import { KnowledgePolicyStateMachine } from "../../src/state-machine/knowledge-policy-state-machine.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("KnowledgePolicyStateMachine", () => {
  it("canTransition() returns true for legal transitions", () => {
    const machine = new KnowledgePolicyStateMachine();
    expect(machine.canTransition(KnowledgePolicyState.DRAFT, KnowledgePolicyState.CREATED)).toBe(
      true,
    );
  });

  it("canTransition() returns false for illegal transitions", () => {
    const machine = new KnowledgePolicyStateMachine();
    expect(machine.canTransition(KnowledgePolicyState.DRAFT, KnowledgePolicyState.ACTIVE)).toBe(
      false,
    );
  });

  it("transition() advances state and appends a history entry", () => {
    const machine = new KnowledgePolicyStateMachine();
    const execution = executionFixture();
    const result = machine.transition({
      execution,
      to: KnowledgePolicyState.CREATED,
      operation: "create_policy",
      reason: "initial",
    });
    expect(result.instance.state).toBe(KnowledgePolicyState.CREATED);
    expect(result.history).toHaveLength(1);
    expect(result.history[0]?.fromState).toBe(KnowledgePolicyState.DRAFT);
    expect(result.history[0]?.toState).toBe(KnowledgePolicyState.CREATED);
    expect(result.history[0]?.reason).toBe("initial");
  });

  it("transition() throws IllegalPolicyTransitionException for an illegal transition", () => {
    const machine = new KnowledgePolicyStateMachine();
    const execution = executionFixture();
    expect(() => machine.transition({ execution, to: KnowledgePolicyState.ACTIVE })).toThrow(
      IllegalPolicyTransitionException,
    );
  });

  it("stamps activatedAt when transitioning to ACTIVE", () => {
    const machine = new KnowledgePolicyStateMachine();
    let execution = executionFixture();
    execution = machine.transition({ execution, to: KnowledgePolicyState.CREATED });
    execution = machine.transition({ execution, to: KnowledgePolicyState.VALIDATED });
    execution = machine.transition({ execution, to: KnowledgePolicyState.ACTIVE });
    expect(execution.instance.activatedAt).toBeTruthy();
  });

  it("stamps destroyedAt when transitioning to DESTROYED", () => {
    const machine = new KnowledgePolicyStateMachine();
    const execution = executionFixture();
    const result = machine.transition({ execution, to: KnowledgePolicyState.DESTROYED });
    expect(result.instance.destroyedAt).toBeTruthy();
  });

  it("defaults operation to 'transition' when not supplied", () => {
    const machine = new KnowledgePolicyStateMachine();
    const execution = executionFixture();
    const result = machine.transition({ execution, to: KnowledgePolicyState.CREATED });
    expect(result.history[0]?.operation).toBe("transition");
  });

  it("DESTROYED is a hard terminal state with no legal outgoing transitions", () => {
    const machine = new KnowledgePolicyStateMachine();
    for (const state of Object.values(KnowledgePolicyState)) {
      expect(machine.canTransition(KnowledgePolicyState.DESTROYED, state)).toBe(false);
    }
  });
});

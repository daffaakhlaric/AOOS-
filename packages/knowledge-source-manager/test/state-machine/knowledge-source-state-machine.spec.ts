import { describe, expect, it } from "vitest";

import { KnowledgeSourceState } from "../../src/domain/knowledge-source-state.js";
import { IllegalSourceTransitionException } from "../../src/errors/illegal-source-transition-exception.js";
import { KnowledgeSourceStateMachine } from "../../src/state-machine/knowledge-source-state-machine.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("KnowledgeSourceStateMachine", () => {
  it("allows Created -> Registered", () => {
    const machine = new KnowledgeSourceStateMachine();
    expect(
      machine.canTransition(KnowledgeSourceState.CREATED, KnowledgeSourceState.REGISTERED),
    ).toBe(true);
  });

  it("rejects Created -> Enabled", () => {
    const machine = new KnowledgeSourceStateMachine();
    expect(machine.canTransition(KnowledgeSourceState.CREATED, KnowledgeSourceState.ENABLED)).toBe(
      false,
    );
  });

  it("performs a legal transition and appends history", () => {
    const machine = new KnowledgeSourceStateMachine();
    const execution = executionFixture();
    const next = machine.transition({ execution, to: KnowledgeSourceState.REGISTERED });
    expect(next.instance.state).toBe(KnowledgeSourceState.REGISTERED);
    expect(next.history).toHaveLength(1);
    expect(next.history[0]?.fromState).toBe(KnowledgeSourceState.CREATED);
    expect(next.history[0]?.toState).toBe(KnowledgeSourceState.REGISTERED);
  });

  it("records the transition reason when supplied", () => {
    const machine = new KnowledgeSourceStateMachine();
    const execution = executionFixture();
    const next = machine.transition({
      execution,
      to: KnowledgeSourceState.REGISTERED,
      reason: "auto-advance",
    });
    expect(next.history[0]?.reason).toBe("auto-advance");
  });

  it("throws IllegalSourceTransitionException for an illegal transition", () => {
    const machine = new KnowledgeSourceStateMachine();
    const execution = executionFixture();
    expect(() => machine.transition({ execution, to: KnowledgeSourceState.DESTROYED })).toThrow(
      IllegalSourceTransitionException,
    );
  });

  it("throws from the hard-terminal Destroyed state", () => {
    const machine = new KnowledgeSourceStateMachine();
    const execution = executionFixture({
      instance: { ...executionFixture().instance, state: KnowledgeSourceState.DESTROYED },
    });
    expect(() => machine.transition({ execution, to: KnowledgeSourceState.ENABLED })).toThrow(
      IllegalSourceTransitionException,
    );
  });

  it("bumps updatedAt on every transition", () => {
    const machine = new KnowledgeSourceStateMachine();
    const execution = executionFixture({
      instance: { ...executionFixture().instance, updatedAt: "2020-01-01T00:00:00.000Z" },
    });
    const next = machine.transition({ execution, to: KnowledgeSourceState.REGISTERED });
    expect(next.instance.updatedAt).not.toBe("2020-01-01T00:00:00.000Z");
  });
});

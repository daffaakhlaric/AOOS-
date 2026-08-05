import { describe, expect, it } from "vitest";

import { KnowledgeProviderState } from "../../src/domain/knowledge-provider-state.js";
import { IllegalProviderTransitionException } from "../../src/errors/illegal-provider-transition-exception.js";
import { KnowledgeProviderStateMachine } from "../../src/state-machine/knowledge-provider-state-machine.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("KnowledgeProviderStateMachine", () => {
  it("allows a legal transition", () => {
    const machine = new KnowledgeProviderStateMachine();
    expect(
      machine.canTransition(KnowledgeProviderState.REGISTERED, KnowledgeProviderState.VALIDATED),
    ).toBe(true);
  });

  it("disallows an illegal transition", () => {
    const machine = new KnowledgeProviderStateMachine();
    expect(
      machine.canTransition(KnowledgeProviderState.REGISTERED, KnowledgeProviderState.READY),
    ).toBe(false);
  });

  it("transitions an execution and appends a history entry", () => {
    const machine = new KnowledgeProviderStateMachine();
    const execution = executionFixture();
    const next = machine.transition({ execution, to: KnowledgeProviderState.VALIDATED });
    expect(next.instance.state).toBe(KnowledgeProviderState.VALIDATED);
    expect(next.history).toHaveLength(1);
    expect(next.history[0]).toMatchObject({
      sequence: 0,
      fromState: KnowledgeProviderState.REGISTERED,
      toState: KnowledgeProviderState.VALIDATED,
    });
  });

  it("records the reason when supplied", () => {
    const machine = new KnowledgeProviderStateMachine();
    const execution = executionFixture();
    const next = machine.transition({
      execution,
      to: KnowledgeProviderState.FAILED,
      reason: "invalid metadata",
    });
    expect(next.history[0]?.reason).toBe("invalid metadata");
  });

  it("throws IllegalProviderTransitionException for an illegal transition", () => {
    const machine = new KnowledgeProviderStateMachine();
    const execution = executionFixture();
    expect(() => machine.transition({ execution, to: KnowledgeProviderState.READY })).toThrow(
      IllegalProviderTransitionException,
    );
  });

  it("never allows a transition out of DESTROYED", () => {
    const machine = new KnowledgeProviderStateMachine();
    const execution = executionFixture({
      instance: { ...executionFixture().instance, state: KnowledgeProviderState.DESTROYED },
    });
    expect(() => machine.transition({ execution, to: KnowledgeProviderState.REGISTERED })).toThrow(
      IllegalProviderTransitionException,
    );
  });

  it("allows the full happy path REGISTERED->VALIDATED->CONFIGURED->CONNECTED->READY", () => {
    const machine = new KnowledgeProviderStateMachine();
    let execution = executionFixture();
    for (const to of [
      KnowledgeProviderState.VALIDATED,
      KnowledgeProviderState.CONFIGURED,
      KnowledgeProviderState.CONNECTED,
      KnowledgeProviderState.READY,
    ]) {
      execution = machine.transition({ execution, to });
    }
    expect(execution.instance.state).toBe(KnowledgeProviderState.READY);
    expect(execution.history).toHaveLength(4);
  });

  it("allows READY to SYNCHRONIZING and back to READY", () => {
    const machine = new KnowledgeProviderStateMachine();
    let execution = executionFixture({
      instance: { ...executionFixture().instance, state: KnowledgeProviderState.READY },
    });
    execution = machine.transition({ execution, to: KnowledgeProviderState.SYNCHRONIZING });
    expect(execution.instance.state).toBe(KnowledgeProviderState.SYNCHRONIZING);
    execution = machine.transition({ execution, to: KnowledgeProviderState.READY });
    expect(execution.instance.state).toBe(KnowledgeProviderState.READY);
  });

  it("allows FAILED to transition to DESTROYED", () => {
    const machine = new KnowledgeProviderStateMachine();
    const execution = executionFixture({
      instance: { ...executionFixture().instance, state: KnowledgeProviderState.FAILED },
    });
    const next = machine.transition({ execution, to: KnowledgeProviderState.DESTROYED });
    expect(next.instance.state).toBe(KnowledgeProviderState.DESTROYED);
  });
});

import { describe, expect, it } from "vitest";

import { KnowledgeRuntimeState } from "../../src/domain/knowledge-runtime-state.js";
import { IllegalRuntimeTransitionException } from "../../src/errors/illegal-runtime-transition-exception.js";
import { KnowledgeRuntimeStateMachine } from "../../src/state-machine/knowledge-runtime-state-machine.js";
import { engineFixture } from "../helpers/engine-fixture.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("State Machine Test — KnowledgeRuntimeStateMachine", () => {
  it("canTransition() reports true for a legal edge, false for an illegal one", () => {
    const machine = new KnowledgeRuntimeStateMachine();
    expect(
      machine.canTransition(KnowledgeRuntimeState.CREATED, KnowledgeRuntimeState.LOADING),
    ).toBe(true);
    expect(
      machine.canTransition(KnowledgeRuntimeState.CREATED, KnowledgeRuntimeState.RUNNING),
    ).toBe(false);
  });

  it("transition() moves the Instance state and appends a History entry", async () => {
    const { asset } = await engineFixture();
    const execution = executionFixture(asset);
    const machine = new KnowledgeRuntimeStateMachine();
    const result = machine.transition({ execution, to: KnowledgeRuntimeState.LOADING });
    expect(result.instance.state).toBe(KnowledgeRuntimeState.LOADING);
    expect(result.history).toHaveLength(1);
    expect(result.history[0]).toMatchObject({
      sequence: 0,
      fromState: KnowledgeRuntimeState.CREATED,
      toState: KnowledgeRuntimeState.LOADING,
    });
  });

  it("transition() throws IllegalRuntimeTransitionException for an illegal edge", async () => {
    const { asset } = await engineFixture();
    const execution = executionFixture(asset);
    const machine = new KnowledgeRuntimeStateMachine();
    expect(() => machine.transition({ execution, to: KnowledgeRuntimeState.RUNNING })).toThrow(
      IllegalRuntimeTransitionException,
    );
  });

  it("transition() increments instance.statistics.transitionCount", async () => {
    const { asset } = await engineFixture();
    const execution = executionFixture(asset);
    const machine = new KnowledgeRuntimeStateMachine();
    const result = machine.transition({ execution, to: KnowledgeRuntimeState.LOADING });
    expect(result.instance.statistics.transitionCount).toBe(1);
  });

  it("transition() records an optional reason", async () => {
    const { asset } = await engineFixture();
    const execution = executionFixture(asset);
    const machine = new KnowledgeRuntimeStateMachine();
    const result = machine.transition({
      execution,
      to: KnowledgeRuntimeState.CANCELLED,
      reason: "user requested",
    });
    expect(result.history[0]?.reason).toBe("user requested");
  });
});

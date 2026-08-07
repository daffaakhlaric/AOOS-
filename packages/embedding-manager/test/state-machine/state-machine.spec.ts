import { describe, expect, it } from "vitest";

import { EmbeddingState } from "../../src/domain/embedding-state.js";
import { IllegalEmbeddingTransitionException } from "../../src/errors/illegal-embedding-transition-exception.js";
import { EmbeddingStateMachine } from "../../src/state-machine/embedding-state-machine.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("EmbeddingStateMachine", () => {
  it("canTransition(DRAFT, QUEUED) is true", () => {
    const sm = new EmbeddingStateMachine();
    expect(sm.canTransition(EmbeddingState.DRAFT, EmbeddingState.QUEUED)).toBe(true);
  });

  it("canTransition(DRAFT, COMPLETED) is false", () => {
    const sm = new EmbeddingStateMachine();
    expect(sm.canTransition(EmbeddingState.DRAFT, EmbeddingState.COMPLETED)).toBe(false);
  });

  it("transition() moves the instance state and appends a history entry", () => {
    const sm = new EmbeddingStateMachine();
    const execution = executionFixture();
    const result = sm.transition({ execution, to: EmbeddingState.QUEUED, operation: "queue" });
    expect(result.instance.state).toBe(EmbeddingState.QUEUED);
    expect(result.history).toHaveLength(1);
    expect(result.history[0]!.fromState).toBe(EmbeddingState.DRAFT);
    expect(result.history[0]!.toState).toBe(EmbeddingState.QUEUED);
  });

  it("transition() throws IllegalEmbeddingTransitionException for an illegal edge", () => {
    const sm = new EmbeddingStateMachine();
    const execution = executionFixture();
    expect(() => sm.transition({ execution, to: EmbeddingState.COMPLETED })).toThrow(
      IllegalEmbeddingTransitionException,
    );
  });

  it("transition() stamps startedAt on entering EMBEDDING", () => {
    const sm = new EmbeddingStateMachine();
    let execution = executionFixture();
    execution = sm.transition({ execution, to: EmbeddingState.QUEUED });
    execution = sm.transition({ execution, to: EmbeddingState.PREPARING });
    execution = sm.transition({ execution, to: EmbeddingState.EMBEDDING });
    expect(execution.instance.startedAt).toBeDefined();
  });

  it.each([EmbeddingState.COMPLETED, EmbeddingState.FAILED, EmbeddingState.CANCELLED])(
    "transition() stamps settledAt on entering %s (from a reachable state)",
    (target) => {
      const sm = new EmbeddingStateMachine();
      let execution = executionFixture();
      execution = sm.transition({ execution, to: EmbeddingState.QUEUED });
      execution = sm.transition({ execution, to: EmbeddingState.PREPARING });
      if (target !== EmbeddingState.CANCELLED) {
        execution = sm.transition({ execution, to: EmbeddingState.EMBEDDING });
      }
      execution = sm.transition({ execution, to: target });
      expect(execution.instance.settledAt).toBeDefined();
    },
  );

  it("transition() stamps settledAt on entering ARCHIVED via COMPLETED", () => {
    const sm = new EmbeddingStateMachine();
    let execution = executionFixture();
    execution = sm.transition({ execution, to: EmbeddingState.QUEUED });
    execution = sm.transition({ execution, to: EmbeddingState.PREPARING });
    execution = sm.transition({ execution, to: EmbeddingState.EMBEDDING });
    execution = sm.transition({ execution, to: EmbeddingState.COMPLETED });
    execution = sm.transition({ execution, to: EmbeddingState.ARCHIVED });
    expect(execution.instance.settledAt).toBeDefined();
  });

  it("transition() default operation label is 'transition' when none supplied", () => {
    const sm = new EmbeddingStateMachine();
    const execution = executionFixture();
    const result = sm.transition({ execution, to: EmbeddingState.QUEUED });
    expect(result.history[0]!.operation).toBe("transition");
  });

  it("transition() records the supplied reason", () => {
    const sm = new EmbeddingStateMachine();
    const execution = executionFixture();
    const result = sm.transition({ execution, to: EmbeddingState.QUEUED, reason: "because" });
    expect(result.history[0]!.reason).toBe("because");
  });

  it("transition() increments the sequence for each subsequent transition", () => {
    const sm = new EmbeddingStateMachine();
    let execution = executionFixture();
    execution = sm.transition({ execution, to: EmbeddingState.QUEUED });
    execution = sm.transition({ execution, to: EmbeddingState.PREPARING });
    expect(execution.history[1]!.sequence).toBe(1);
  });
});

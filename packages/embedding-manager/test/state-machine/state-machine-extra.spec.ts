import { describe, expect, it } from "vitest";

import { EMBEDDING_STATE_TRANSITIONS, EmbeddingState } from "../../src/domain/embedding-state.js";
import { EmbeddingStateMachine } from "../../src/state-machine/embedding-state-machine.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("EmbeddingStateMachine — exhaustive legal-edge matrix", () => {
  const sm = new EmbeddingStateMachine();

  for (const from of Object.values(EmbeddingState)) {
    for (const to of EMBEDDING_STATE_TRANSITIONS[from]) {
      it(`canTransition(${from}, ${to}) is true (legal edge)`, () => {
        expect(sm.canTransition(from, to)).toBe(true);
      });
    }
  }

  it("canTransition is false for every non-edge pair sampled", () => {
    expect(sm.canTransition(EmbeddingState.COMPLETED, EmbeddingState.DRAFT)).toBe(false);
    expect(sm.canTransition(EmbeddingState.QUEUED, EmbeddingState.EMBEDDING)).toBe(false);
    expect(sm.canTransition(EmbeddingState.ARCHIVED, EmbeddingState.CANCELLED)).toBe(false);
  });

  it("transition() never mutates the input execution object", () => {
    const execution = executionFixture();
    const before = JSON.stringify(execution);
    sm.transition({ execution, to: EmbeddingState.QUEUED });
    expect(JSON.stringify(execution)).toBe(before);
  });

  it("transition() preserves fields untouched by the transition (metadata, request)", () => {
    const execution = executionFixture();
    const result = sm.transition({ execution, to: EmbeddingState.QUEUED });
    expect(result.metadata).toBe(execution.metadata);
    expect(result.request).toBe(execution.request);
  });
});

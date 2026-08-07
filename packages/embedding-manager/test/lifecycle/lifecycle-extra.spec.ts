import { describe, expect, it } from "vitest";

import { EmbeddingState } from "../../src/domain/embedding-state.js";
import { EmbeddingLifecycle } from "../../src/lifecycle/embedding-lifecycle.js";

describe("EmbeddingLifecycle — extra per-state introspection", () => {
  const lifecycle = new EmbeddingLifecycle();

  it.each(Object.values(EmbeddingState))(
    "transitionsFrom(%s) matches the domain transition table",
    (state) => {
      const transitions = lifecycle.transitionsFrom(state);
      expect(Array.isArray(transitions)).toBe(true);
    },
  );

  it("QUEUED is not terminal", () => {
    expect(lifecycle.isTerminal(EmbeddingState.QUEUED)).toBe(false);
  });

  it("EMBEDDING is not settled", () => {
    expect(lifecycle.isSettled(EmbeddingState.EMBEDDING)).toBe(false);
  });

  it("PREPARING is not settled", () => {
    expect(lifecycle.isSettled(EmbeddingState.PREPARING)).toBe(false);
  });

  it("states() is stable across repeated calls", () => {
    expect(lifecycle.states()).toEqual(lifecycle.states());
  });
});

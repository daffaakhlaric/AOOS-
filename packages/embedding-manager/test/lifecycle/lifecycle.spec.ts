import { describe, expect, it } from "vitest";

import { EmbeddingState } from "../../src/domain/embedding-state.js";
import { EmbeddingLifecycle } from "../../src/lifecycle/embedding-lifecycle.js";

describe("EmbeddingLifecycle", () => {
  const lifecycle = new EmbeddingLifecycle();

  it("states() returns exactly the 9 documented states", () => {
    expect(lifecycle.states()).toHaveLength(9);
  });

  it("transitionsFrom(DRAFT) allows QUEUED/CANCELLED/DESTROYED", () => {
    expect(lifecycle.transitionsFrom(EmbeddingState.DRAFT)).toEqual([
      EmbeddingState.QUEUED,
      EmbeddingState.CANCELLED,
      EmbeddingState.DESTROYED,
    ]);
  });

  it("isTerminal(DESTROYED) is true", () => {
    expect(lifecycle.isTerminal(EmbeddingState.DESTROYED)).toBe(true);
  });

  it("isTerminal(DRAFT) is false", () => {
    expect(lifecycle.isTerminal(EmbeddingState.DRAFT)).toBe(false);
  });

  it.each([
    EmbeddingState.COMPLETED,
    EmbeddingState.FAILED,
    EmbeddingState.CANCELLED,
    EmbeddingState.ARCHIVED,
    EmbeddingState.DESTROYED,
  ])("isSettled(%s) is true", (state) => {
    expect(lifecycle.isSettled(state)).toBe(true);
  });

  it.each([
    EmbeddingState.DRAFT,
    EmbeddingState.QUEUED,
    EmbeddingState.PREPARING,
    EmbeddingState.EMBEDDING,
  ])("isSettled(%s) is false", (state) => {
    expect(lifecycle.isSettled(state)).toBe(false);
  });

  it("DESTROYED has no outgoing transitions", () => {
    expect(lifecycle.transitionsFrom(EmbeddingState.DESTROYED)).toEqual([]);
  });

  it("every state is reachable from DRAFT via BFS", () => {
    const visited = new Set<EmbeddingState>([EmbeddingState.DRAFT]);
    const queue: EmbeddingState[] = [EmbeddingState.DRAFT];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const next of lifecycle.transitionsFrom(current)) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    expect(visited.size).toBe(9);
  });
});

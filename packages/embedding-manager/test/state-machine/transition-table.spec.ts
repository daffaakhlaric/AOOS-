import { describe, expect, it } from "vitest";

import {
  EMBEDDING_SETTLED_STATES,
  EMBEDDING_STATE_TRANSITIONS,
  EMBEDDING_TERMINAL_STATES,
  EmbeddingState,
} from "../../src/domain/embedding-state.js";

describe("EMBEDDING_STATE_TRANSITIONS", () => {
  it("has an entry for every one of the 9 states", () => {
    for (const state of Object.values(EmbeddingState)) {
      expect(EMBEDDING_STATE_TRANSITIONS[state]).toBeDefined();
    }
  });

  it("DESTROYED has no outgoing edges", () => {
    expect(EMBEDDING_STATE_TRANSITIONS[EmbeddingState.DESTROYED]).toEqual([]);
  });

  it("every state has an edge into DESTROYED", () => {
    for (const state of Object.values(EmbeddingState)) {
      if (state === EmbeddingState.DESTROYED) continue;
      expect(EMBEDDING_STATE_TRANSITIONS[state]).toContain(EmbeddingState.DESTROYED);
    }
  });

  it("every state is reachable from DRAFT (BFS)", () => {
    const visited = new Set<EmbeddingState>([EmbeddingState.DRAFT]);
    const queue: EmbeddingState[] = [EmbeddingState.DRAFT];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const next of EMBEDDING_STATE_TRANSITIONS[current]) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    expect(visited.size).toBe(Object.values(EmbeddingState).length);
  });

  it("EMBEDDING_TERMINAL_STATES contains only DESTROYED", () => {
    expect(EMBEDDING_TERMINAL_STATES.size).toBe(1);
    expect(EMBEDDING_TERMINAL_STATES.has(EmbeddingState.DESTROYED)).toBe(true);
  });

  it("EMBEDDING_SETTLED_STATES contains the 5 settled outcomes", () => {
    expect(EMBEDDING_SETTLED_STATES.size).toBe(5);
    expect(EMBEDDING_SETTLED_STATES.has(EmbeddingState.COMPLETED)).toBe(true);
    expect(EMBEDDING_SETTLED_STATES.has(EmbeddingState.FAILED)).toBe(true);
    expect(EMBEDDING_SETTLED_STATES.has(EmbeddingState.CANCELLED)).toBe(true);
    expect(EMBEDDING_SETTLED_STATES.has(EmbeddingState.ARCHIVED)).toBe(true);
    expect(EMBEDDING_SETTLED_STATES.has(EmbeddingState.DESTROYED)).toBe(true);
  });

  it("mainline path Draft -> Queued -> Preparing -> Embedding -> Completed is fully legal", () => {
    const path = [
      EmbeddingState.DRAFT,
      EmbeddingState.QUEUED,
      EmbeddingState.PREPARING,
      EmbeddingState.EMBEDDING,
      EmbeddingState.COMPLETED,
    ];
    for (let i = 0; i < path.length - 1; i += 1) {
      expect(EMBEDDING_STATE_TRANSITIONS[path[i]!]).toContain(path[i + 1]!);
    }
  });
});

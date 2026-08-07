import { describe, expect, it } from "vitest";

import { KnowledgeGenerationState } from "../../src/domain/knowledge-generation-state.js";
import { KnowledgeGeneratorLifecycle } from "../../src/lifecycle/knowledge-generator-lifecycle.js";

describe("KnowledgeGeneratorLifecycle", () => {
  const lifecycle = new KnowledgeGeneratorLifecycle();

  it("states() returns all 10 states", () => {
    expect(lifecycle.states()).toHaveLength(10);
  });

  it("transitionsFrom() mirrors the transition table for Draft", () => {
    expect(lifecycle.transitionsFrom(KnowledgeGenerationState.DRAFT)).toEqual([
      KnowledgeGenerationState.QUEUED,
      KnowledgeGenerationState.CANCELLED,
      KnowledgeGenerationState.DESTROYED,
    ]);
  });

  it("transitionsFrom() returns an empty array for Destroyed", () => {
    expect(lifecycle.transitionsFrom(KnowledgeGenerationState.DESTROYED)).toEqual([]);
  });

  it("isTerminal() is true only for Destroyed", () => {
    for (const state of lifecycle.states()) {
      expect(lifecycle.isTerminal(state)).toBe(state === KnowledgeGenerationState.DESTROYED);
    }
  });

  it("isSettled() is true for Completed/Cancelled/Failed/Archived/Destroyed", () => {
    expect(lifecycle.isSettled(KnowledgeGenerationState.COMPLETED)).toBe(true);
    expect(lifecycle.isSettled(KnowledgeGenerationState.CANCELLED)).toBe(true);
    expect(lifecycle.isSettled(KnowledgeGenerationState.FAILED)).toBe(true);
    expect(lifecycle.isSettled(KnowledgeGenerationState.ARCHIVED)).toBe(true);
    expect(lifecycle.isSettled(KnowledgeGenerationState.DESTROYED)).toBe(true);
  });

  it("isSettled() is false for Draft/Queued/Preparing/Generating/Reviewing", () => {
    expect(lifecycle.isSettled(KnowledgeGenerationState.DRAFT)).toBe(false);
    expect(lifecycle.isSettled(KnowledgeGenerationState.QUEUED)).toBe(false);
    expect(lifecycle.isSettled(KnowledgeGenerationState.PREPARING)).toBe(false);
    expect(lifecycle.isSettled(KnowledgeGenerationState.GENERATING)).toBe(false);
    expect(lifecycle.isSettled(KnowledgeGenerationState.REVIEWING)).toBe(false);
  });

  it("every state is reachable from Draft via transitionsFrom()", () => {
    const reachable = new Set<KnowledgeGenerationState>([KnowledgeGenerationState.DRAFT]);
    let frontier = [KnowledgeGenerationState.DRAFT];
    while (frontier.length > 0) {
      const next: KnowledgeGenerationState[] = [];
      for (const state of frontier) {
        for (const target of lifecycle.transitionsFrom(state)) {
          if (!reachable.has(target)) {
            reachable.add(target);
            next.push(target);
          }
        }
      }
      frontier = next;
    }
    expect(reachable.size).toBe(lifecycle.states().length);
  });
});

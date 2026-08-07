import { describe, expect, it } from "vitest";

import { KnowledgeVersionState } from "../../src/domain/knowledge-version-state.js";
import { KnowledgeVersionLifecycle } from "../../src/lifecycle/knowledge-version-lifecycle.js";

describe("KnowledgeVersionLifecycle", () => {
  const lifecycle = new KnowledgeVersionLifecycle();

  it("lists all 11 states", () => {
    expect(lifecycle.states()).toHaveLength(11);
  });

  it("returns legal transitions from a given state", () => {
    expect(lifecycle.transitionsFrom(KnowledgeVersionState.DRAFT)).toEqual([
      KnowledgeVersionState.CREATED,
      KnowledgeVersionState.DESTROYED,
    ]);
  });

  it("identifies DESTROYED as terminal", () => {
    expect(lifecycle.isTerminal(KnowledgeVersionState.DESTROYED)).toBe(true);
    expect(lifecycle.isTerminal(KnowledgeVersionState.DRAFT)).toBe(false);
  });

  it("identifies settled states", () => {
    expect(lifecycle.isSettled(KnowledgeVersionState.ARCHIVED)).toBe(true);
    expect(lifecycle.isSettled(KnowledgeVersionState.DRAFT)).toBe(false);
  });
});

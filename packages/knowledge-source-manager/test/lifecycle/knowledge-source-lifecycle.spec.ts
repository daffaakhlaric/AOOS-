import { describe, expect, it } from "vitest";

import { KnowledgeSourceState } from "../../src/domain/knowledge-source-state.js";
import { KnowledgeSourceLifecycle } from "../../src/lifecycle/knowledge-source-lifecycle.js";

describe("KnowledgeSourceLifecycle", () => {
  it("lists all 12 states", () => {
    const lifecycle = new KnowledgeSourceLifecycle();
    expect(lifecycle.states()).toHaveLength(12);
  });

  it("returns the transitions available from a given state", () => {
    const lifecycle = new KnowledgeSourceLifecycle();
    expect(lifecycle.transitionsFrom(KnowledgeSourceState.VALIDATED)).toEqual([
      KnowledgeSourceState.ENABLED,
      KnowledgeSourceState.SCHEDULED,
    ]);
  });

  it("identifies Destroyed as terminal", () => {
    const lifecycle = new KnowledgeSourceLifecycle();
    expect(lifecycle.isTerminal(KnowledgeSourceState.DESTROYED)).toBe(true);
    expect(lifecycle.isTerminal(KnowledgeSourceState.ENABLED)).toBe(false);
  });

  it("identifies settled states", () => {
    const lifecycle = new KnowledgeSourceLifecycle();
    expect(lifecycle.isSettled(KnowledgeSourceState.ARCHIVED)).toBe(true);
    expect(lifecycle.isSettled(KnowledgeSourceState.ENABLED)).toBe(false);
  });
});

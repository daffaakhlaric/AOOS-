import { describe, expect, it } from "vitest";

import { KnowledgeProviderState } from "../../src/domain/knowledge-provider-state.js";
import { KnowledgeProviderLifecycle } from "../../src/lifecycle/knowledge-provider-lifecycle.js";

describe("KnowledgeProviderLifecycle", () => {
  it("states() returns all 10 lifecycle states", () => {
    const lifecycle = new KnowledgeProviderLifecycle();
    expect(lifecycle.states()).toHaveLength(10);
  });

  it("transitionsFrom() returns the legal transitions for a state", () => {
    const lifecycle = new KnowledgeProviderLifecycle();
    expect(lifecycle.transitionsFrom(KnowledgeProviderState.REGISTERED)).toEqual([
      KnowledgeProviderState.VALIDATED,
      KnowledgeProviderState.FAILED,
    ]);
  });

  it("isTerminal() is true only for DESTROYED", () => {
    const lifecycle = new KnowledgeProviderLifecycle();
    expect(lifecycle.isTerminal(KnowledgeProviderState.DESTROYED)).toBe(true);
    expect(lifecycle.isTerminal(KnowledgeProviderState.FAILED)).toBe(false);
  });

  it("isSettled() is true for the 4 settled states", () => {
    const lifecycle = new KnowledgeProviderLifecycle();
    expect(lifecycle.isSettled(KnowledgeProviderState.FAILED)).toBe(true);
    expect(lifecycle.isSettled(KnowledgeProviderState.REGISTERED)).toBe(false);
  });
});

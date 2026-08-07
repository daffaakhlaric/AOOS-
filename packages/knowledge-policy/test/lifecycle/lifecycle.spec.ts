import { describe, expect, it } from "vitest";

import { KnowledgePolicyState } from "../../src/domain/knowledge-policy-state.js";
import { KnowledgePolicyLifecycle } from "../../src/lifecycle/knowledge-policy-lifecycle.js";

describe("KnowledgePolicyLifecycle", () => {
  const lifecycle = new KnowledgePolicyLifecycle();

  it("states() returns all 9 KnowledgePolicyState members", () => {
    expect(lifecycle.states()).toHaveLength(9);
  });

  it("transitionsFrom() returns the legal transitions for a state", () => {
    expect(lifecycle.transitionsFrom(KnowledgePolicyState.DRAFT)).toEqual([
      KnowledgePolicyState.CREATED,
      KnowledgePolicyState.DESTROYED,
    ]);
  });

  it("isTerminal() is true only for DESTROYED", () => {
    expect(lifecycle.isTerminal(KnowledgePolicyState.DESTROYED)).toBe(true);
    expect(lifecycle.isTerminal(KnowledgePolicyState.DRAFT)).toBe(false);
  });

  it("isSettled() is true for suspended/deprecated/archived/destroyed", () => {
    expect(lifecycle.isSettled(KnowledgePolicyState.SUSPENDED)).toBe(true);
    expect(lifecycle.isSettled(KnowledgePolicyState.DEPRECATED)).toBe(true);
    expect(lifecycle.isSettled(KnowledgePolicyState.ARCHIVED)).toBe(true);
    expect(lifecycle.isSettled(KnowledgePolicyState.DESTROYED)).toBe(true);
    expect(lifecycle.isSettled(KnowledgePolicyState.ACTIVE)).toBe(false);
  });
});

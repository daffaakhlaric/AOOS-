import { describe, expect, it } from "vitest";

import { KnowledgeSynchronizationState } from "../../src/domain/knowledge-synchronization-state.js";
import { KnowledgeSynchronizationLifecycle } from "../../src/lifecycle/knowledge-synchronization-lifecycle.js";

describe("KnowledgeSynchronizationLifecycle", () => {
  it("states() returns all 13 lifecycle states", () => {
    const lifecycle = new KnowledgeSynchronizationLifecycle();
    expect(lifecycle.states()).toHaveLength(13);
  });

  it("transitionsFrom() returns the legal transitions for a state", () => {
    const lifecycle = new KnowledgeSynchronizationLifecycle();
    expect(lifecycle.transitionsFrom(KnowledgeSynchronizationState.CREATED)).toEqual([
      KnowledgeSynchronizationState.QUEUED,
      KnowledgeSynchronizationState.CANCELLED,
    ]);
  });

  it("isTerminal() is true only for DESTROYED", () => {
    const lifecycle = new KnowledgeSynchronizationLifecycle();
    expect(lifecycle.isTerminal(KnowledgeSynchronizationState.DESTROYED)).toBe(true);
    expect(lifecycle.isTerminal(KnowledgeSynchronizationState.COMPLETED)).toBe(false);
  });

  it("isSettled() is true for the 5 settled states", () => {
    const lifecycle = new KnowledgeSynchronizationLifecycle();
    expect(lifecycle.isSettled(KnowledgeSynchronizationState.COMPLETED)).toBe(true);
    expect(lifecycle.isSettled(KnowledgeSynchronizationState.CREATED)).toBe(false);
  });
});

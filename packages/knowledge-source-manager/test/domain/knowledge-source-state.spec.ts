import { describe, expect, it } from "vitest";

import {
  KNOWLEDGE_SOURCE_SETTLED_STATES,
  KNOWLEDGE_SOURCE_STATE_TRANSITIONS,
  KNOWLEDGE_SOURCE_TERMINAL_STATES,
  KnowledgeSourceState,
} from "../../src/domain/knowledge-source-state.js";

describe("KnowledgeSourceState", () => {
  it("has exactly the 12 states named in the prompt, in order", () => {
    expect(Object.values(KnowledgeSourceState)).toEqual([
      "created",
      "registered",
      "configured",
      "validated",
      "enabled",
      "disabled",
      "scheduled",
      "synchronizing",
      "paused",
      "archived",
      "deleted",
      "destroyed",
    ]);
  });

  it("defines a transition table entry for every state", () => {
    for (const state of Object.values(KnowledgeSourceState)) {
      expect(KNOWLEDGE_SOURCE_STATE_TRANSITIONS[state]).toBeDefined();
    }
  });

  it("marks Destroyed as the only terminal state", () => {
    expect(KNOWLEDGE_SOURCE_TERMINAL_STATES.size).toBe(1);
    expect(KNOWLEDGE_SOURCE_TERMINAL_STATES.has(KnowledgeSourceState.DESTROYED)).toBe(true);
  });

  it("has no outgoing edges from Destroyed", () => {
    expect(KNOWLEDGE_SOURCE_STATE_TRANSITIONS[KnowledgeSourceState.DESTROYED]).toEqual([]);
  });

  it("marks Disabled/Archived/Deleted/Destroyed as settled", () => {
    expect(KNOWLEDGE_SOURCE_SETTLED_STATES.has(KnowledgeSourceState.DISABLED)).toBe(true);
    expect(KNOWLEDGE_SOURCE_SETTLED_STATES.has(KnowledgeSourceState.ARCHIVED)).toBe(true);
    expect(KNOWLEDGE_SOURCE_SETTLED_STATES.has(KnowledgeSourceState.DELETED)).toBe(true);
    expect(KNOWLEDGE_SOURCE_SETTLED_STATES.has(KnowledgeSourceState.DESTROYED)).toBe(true);
    expect(KNOWLEDGE_SOURCE_SETTLED_STATES.has(KnowledgeSourceState.ENABLED)).toBe(false);
  });

  it("reaches every state from Created via some path", () => {
    const reachable = new Set<KnowledgeSourceState>([KnowledgeSourceState.CREATED]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const state of reachable) {
        for (const next of KNOWLEDGE_SOURCE_STATE_TRANSITIONS[state]) {
          if (!reachable.has(next)) {
            reachable.add(next);
            changed = true;
          }
        }
      }
    }
    expect(reachable.size).toBe(Object.values(KnowledgeSourceState).length);
  });
});

import { describe, expect, it } from "vitest";

import {
  KNOWLEDGE_RUNTIME_INACTIVE_STATES,
  KNOWLEDGE_RUNTIME_STATE_TRANSITIONS,
  KNOWLEDGE_RUNTIME_TERMINAL_STATE,
  KnowledgeRuntimeState,
} from "../../src/domain/knowledge-runtime-state.js";

describe("Domain Test — KnowledgeRuntimeState", () => {
  it("declares exactly 13 states", () => {
    expect(Object.values(KnowledgeRuntimeState)).toHaveLength(13);
  });

  it("every state has a transition table entry", () => {
    for (const state of Object.values(KnowledgeRuntimeState)) {
      expect(KNOWLEDGE_RUNTIME_STATE_TRANSITIONS[state]).toBeDefined();
    }
  });

  it("DESTROYED is the only true terminal state (no outgoing transitions)", () => {
    const noOutgoing = Object.values(KnowledgeRuntimeState).filter(
      (state) => KNOWLEDGE_RUNTIME_STATE_TRANSITIONS[state].length === 0,
    );
    expect(noOutgoing).toEqual([KnowledgeRuntimeState.DESTROYED]);
    expect(KNOWLEDGE_RUNTIME_TERMINAL_STATE).toBe(KnowledgeRuntimeState.DESTROYED);
  });

  it("classifies exactly 5 states as inactive", () => {
    expect(KNOWLEDGE_RUNTIME_INACTIVE_STATES.size).toBe(5);
    expect(KNOWLEDGE_RUNTIME_INACTIVE_STATES.has(KnowledgeRuntimeState.RUNNING)).toBe(false);
    expect(KNOWLEDGE_RUNTIME_INACTIVE_STATES.has(KnowledgeRuntimeState.DESTROYED)).toBe(true);
  });

  it("every state is reachable from CREATED via some transition path", () => {
    const reachable = new Set<KnowledgeRuntimeState>([KnowledgeRuntimeState.CREATED]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const state of reachable) {
        for (const next of KNOWLEDGE_RUNTIME_STATE_TRANSITIONS[state]) {
          if (!reachable.has(next)) {
            reachable.add(next);
            changed = true;
          }
        }
      }
    }
    for (const state of Object.values(KnowledgeRuntimeState)) {
      expect(reachable.has(state)).toBe(true);
    }
  });
});

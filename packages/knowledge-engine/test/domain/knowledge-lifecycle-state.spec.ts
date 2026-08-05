import { describe, expect, it } from "vitest";

import {
  KNOWLEDGE_LIFECYCLE_TRANSITIONS,
  KNOWLEDGE_TERMINAL_LIFECYCLE_STATES,
  KnowledgeLifecycleState,
} from "../../src/domain/knowledge-lifecycle-state.js";

describe("Domain Test — KnowledgeLifecycleState", () => {
  it("declares exactly 12 lifecycle states", () => {
    expect(Object.values(KnowledgeLifecycleState)).toHaveLength(12);
  });

  it("every state (except DELETED) has at least one legal outgoing transition", () => {
    for (const state of Object.values(KnowledgeLifecycleState)) {
      if (state === KnowledgeLifecycleState.DELETED) {
        continue;
      }
      expect(KNOWLEDGE_LIFECYCLE_TRANSITIONS[state].length).toBeGreaterThan(0);
    }
  });

  it("DELETED is the sole terminal state with no outgoing transitions", () => {
    expect(KNOWLEDGE_LIFECYCLE_TRANSITIONS[KnowledgeLifecycleState.DELETED]).toEqual([]);
    expect(KNOWLEDGE_TERMINAL_LIFECYCLE_STATES.has(KnowledgeLifecycleState.DELETED)).toBe(true);
    expect(KNOWLEDGE_TERMINAL_LIFECYCLE_STATES.size).toBe(1);
  });

  it("DRAFT can transition to PENDING_REVIEW and ARCHIVED", () => {
    expect(KNOWLEDGE_LIFECYCLE_TRANSITIONS[KnowledgeLifecycleState.DRAFT]).toEqual([
      KnowledgeLifecycleState.PENDING_REVIEW,
      KnowledgeLifecycleState.ARCHIVED,
    ]);
  });

  it("ARCHIVED can only lead to DELETED or DISABLED", () => {
    expect(KNOWLEDGE_LIFECYCLE_TRANSITIONS[KnowledgeLifecycleState.ARCHIVED]).toEqual([
      KnowledgeLifecycleState.DELETED,
      KnowledgeLifecycleState.DISABLED,
    ]);
  });
});

import { describe, expect, it } from "vitest";

import {
  KNOWLEDGE_RETRIEVAL_STATE_TRANSITIONS,
  KNOWLEDGE_RETRIEVAL_TERMINAL_STATES,
  KnowledgeRetrievalState,
} from "../../src/domain/knowledge-retrieval-state.js";

describe("KnowledgeRetrievalState", () => {
  it("has exactly 10 lifecycle states", () => {
    expect(Object.values(KnowledgeRetrievalState)).toHaveLength(10);
  });

  it("defines a transition table entry for every state", () => {
    for (const state of Object.values(KnowledgeRetrievalState)) {
      expect(KNOWLEDGE_RETRIEVAL_STATE_TRANSITIONS[state]).toBeDefined();
    }
  });

  it("allows CREATED to transition to VALIDATING or CANCELLED", () => {
    expect(KNOWLEDGE_RETRIEVAL_STATE_TRANSITIONS[KnowledgeRetrievalState.CREATED]).toEqual([
      KnowledgeRetrievalState.VALIDATING,
      KnowledgeRetrievalState.CANCELLED,
    ]);
  });

  it("marks COMPLETED, FAILED, CANCELLED, EXPIRED as terminal with no outgoing edges", () => {
    for (const state of [
      KnowledgeRetrievalState.COMPLETED,
      KnowledgeRetrievalState.FAILED,
      KnowledgeRetrievalState.CANCELLED,
      KnowledgeRetrievalState.EXPIRED,
    ]) {
      expect(KNOWLEDGE_RETRIEVAL_TERMINAL_STATES.has(state)).toBe(true);
      expect(KNOWLEDGE_RETRIEVAL_STATE_TRANSITIONS[state]).toEqual([]);
    }
  });

  it("does not mark intermediate states as terminal", () => {
    for (const state of [
      KnowledgeRetrievalState.CREATED,
      KnowledgeRetrievalState.VALIDATING,
      KnowledgeRetrievalState.RESOLVING,
      KnowledgeRetrievalState.SEARCHING,
      KnowledgeRetrievalState.RANKING,
      KnowledgeRetrievalState.FILTERING,
    ]) {
      expect(KNOWLEDGE_RETRIEVAL_TERMINAL_STATES.has(state)).toBe(false);
    }
  });

  it("allows SEARCHING to expire", () => {
    expect(KNOWLEDGE_RETRIEVAL_STATE_TRANSITIONS[KnowledgeRetrievalState.SEARCHING]).toContain(
      KnowledgeRetrievalState.EXPIRED,
    );
  });
});

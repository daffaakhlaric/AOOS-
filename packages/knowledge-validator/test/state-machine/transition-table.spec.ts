import { describe, expect, it } from "vitest";

import {
  KNOWLEDGE_VALIDATION_STATE_TRANSITIONS,
  KNOWLEDGE_VALIDATION_TERMINAL_STATES,
  KnowledgeValidationState,
} from "../../src/domain/knowledge-validation-state.js";

function bfsReachable(from: KnowledgeValidationState): Set<KnowledgeValidationState> {
  const visited = new Set<KnowledgeValidationState>([from]);
  const queue = [from];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      continue;
    }
    for (const next of KNOWLEDGE_VALIDATION_STATE_TRANSITIONS[current]) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return visited;
}

describe("KNOWLEDGE_VALIDATION_STATE_TRANSITIONS", () => {
  it("has an entry for every one of the 10 states", () => {
    expect(Object.keys(KNOWLEDGE_VALIDATION_STATE_TRANSITIONS)).toHaveLength(10);
  });

  it("Destroyed has no outgoing edges (hard terminal)", () => {
    expect(KNOWLEDGE_VALIDATION_STATE_TRANSITIONS[KnowledgeValidationState.DESTROYED]).toEqual([]);
  });

  it("every state is reachable from Draft", () => {
    const reachable = bfsReachable(KnowledgeValidationState.DRAFT);
    expect(reachable.size).toBe(10);
  });

  it("Approved is independently reachable from Reviewing", () => {
    expect(
      KNOWLEDGE_VALIDATION_STATE_TRANSITIONS[KnowledgeValidationState.REVIEWING].includes(
        KnowledgeValidationState.APPROVED,
      ),
    ).toBe(true);
  });

  it("Rejected is independently reachable from Reviewing", () => {
    expect(
      KNOWLEDGE_VALIDATION_STATE_TRANSITIONS[KnowledgeValidationState.REVIEWING].includes(
        KnowledgeValidationState.REJECTED,
      ),
    ).toBe(true);
  });

  it("Approved and Rejected are both settled dual outcomes, distinct from each other", () => {
    expect(KnowledgeValidationState.APPROVED).not.toBe(KnowledgeValidationState.REJECTED);
  });

  it("every non-terminal, non-Destroyed state can reach Destroyed", () => {
    for (const state of Object.values(KnowledgeValidationState)) {
      if (state === KnowledgeValidationState.DESTROYED) {
        continue;
      }
      const reachable = bfsReachable(state);
      expect(reachable.has(KnowledgeValidationState.DESTROYED)).toBe(true);
    }
  });

  it("every state except Draft/Destroyed can be Cancelled or is itself settled", () => {
    const cancellable: KnowledgeValidationState[] = [
      KnowledgeValidationState.DRAFT,
      KnowledgeValidationState.QUEUED,
      KnowledgeValidationState.PREPARING,
      KnowledgeValidationState.VALIDATING,
      KnowledgeValidationState.REVIEWING,
    ];
    for (const state of cancellable) {
      expect(
        KNOWLEDGE_VALIDATION_STATE_TRANSITIONS[state].includes(KnowledgeValidationState.CANCELLED),
      ).toBe(true);
    }
  });

  it("Approved, Rejected, and Cancelled all fan into Archived", () => {
    for (const state of [
      KnowledgeValidationState.APPROVED,
      KnowledgeValidationState.REJECTED,
      KnowledgeValidationState.CANCELLED,
    ]) {
      expect(
        KNOWLEDGE_VALIDATION_STATE_TRANSITIONS[state].includes(KnowledgeValidationState.ARCHIVED),
      ).toBe(true);
    }
  });

  it("KNOWLEDGE_VALIDATION_TERMINAL_STATES contains exactly Destroyed", () => {
    expect(KNOWLEDGE_VALIDATION_TERMINAL_STATES.size).toBe(1);
    expect(KNOWLEDGE_VALIDATION_TERMINAL_STATES.has(KnowledgeValidationState.DESTROYED)).toBe(true);
  });

  it("no state has a self-loop", () => {
    for (const state of Object.values(KnowledgeValidationState)) {
      expect(KNOWLEDGE_VALIDATION_STATE_TRANSITIONS[state].includes(state)).toBe(false);
    }
  });
});

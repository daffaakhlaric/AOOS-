import { describe, expect, it } from "vitest";

import {
  KNOWLEDGE_SYNCHRONIZATION_SETTLED_STATES,
  KNOWLEDGE_SYNCHRONIZATION_STATE_TRANSITIONS,
  KNOWLEDGE_SYNCHRONIZATION_TERMINAL_STATES,
  KnowledgeSynchronizationState,
} from "../../src/domain/knowledge-synchronization-state.js";

describe("KnowledgeSynchronizationState", () => {
  it("has exactly 13 lifecycle states", () => {
    expect(Object.values(KnowledgeSynchronizationState)).toHaveLength(13);
  });

  it("defines a transition table entry for every state", () => {
    for (const state of Object.values(KnowledgeSynchronizationState)) {
      expect(KNOWLEDGE_SYNCHRONIZATION_STATE_TRANSITIONS[state]).toBeDefined();
    }
  });

  it("allows CREATED to transition to QUEUED or CANCELLED", () => {
    expect(
      KNOWLEDGE_SYNCHRONIZATION_STATE_TRANSITIONS[KnowledgeSynchronizationState.CREATED],
    ).toEqual([KnowledgeSynchronizationState.QUEUED, KnowledgeSynchronizationState.CANCELLED]);
  });

  it("marks only DESTROYED as hard-terminal with no outgoing edges", () => {
    expect(
      KNOWLEDGE_SYNCHRONIZATION_TERMINAL_STATES.has(KnowledgeSynchronizationState.DESTROYED),
    ).toBe(true);
    expect(
      KNOWLEDGE_SYNCHRONIZATION_STATE_TRANSITIONS[KnowledgeSynchronizationState.DESTROYED],
    ).toEqual([]);
  });

  it("does not mark COMPLETED as hard-terminal even though it is settled", () => {
    expect(
      KNOWLEDGE_SYNCHRONIZATION_TERMINAL_STATES.has(KnowledgeSynchronizationState.COMPLETED),
    ).toBe(false);
    expect(
      KNOWLEDGE_SYNCHRONIZATION_STATE_TRANSITIONS[KnowledgeSynchronizationState.COMPLETED],
    ).toEqual([KnowledgeSynchronizationState.DESTROYED]);
  });

  it("marks COMPLETED/FAILED/CANCELLED/EXPIRED/DESTROYED as settled", () => {
    for (const state of [
      KnowledgeSynchronizationState.COMPLETED,
      KnowledgeSynchronizationState.FAILED,
      KnowledgeSynchronizationState.CANCELLED,
      KnowledgeSynchronizationState.EXPIRED,
      KnowledgeSynchronizationState.DESTROYED,
    ]) {
      expect(KNOWLEDGE_SYNCHRONIZATION_SETTLED_STATES.has(state)).toBe(true);
    }
  });

  it("does not mark intermediate states as settled", () => {
    for (const state of [
      KnowledgeSynchronizationState.CREATED,
      KnowledgeSynchronizationState.QUEUED,
      KnowledgeSynchronizationState.PREPARING,
      KnowledgeSynchronizationState.CONNECTING,
      KnowledgeSynchronizationState.SYNCHRONIZING,
      KnowledgeSynchronizationState.VALIDATING,
      KnowledgeSynchronizationState.COMMITTING,
    ]) {
      expect(KNOWLEDGE_SYNCHRONIZATION_SETTLED_STATES.has(state)).toBe(false);
    }
  });

  it("allows FAILED to transition to RETRYING", () => {
    expect(
      KNOWLEDGE_SYNCHRONIZATION_STATE_TRANSITIONS[KnowledgeSynchronizationState.FAILED],
    ).toContain(KnowledgeSynchronizationState.RETRYING);
  });

  it("allows RETRYING to transition back to PREPARING", () => {
    expect(
      KNOWLEDGE_SYNCHRONIZATION_STATE_TRANSITIONS[KnowledgeSynchronizationState.RETRYING],
    ).toContain(KnowledgeSynchronizationState.PREPARING);
  });

  it("allows SYNCHRONIZING to expire", () => {
    expect(
      KNOWLEDGE_SYNCHRONIZATION_STATE_TRANSITIONS[KnowledgeSynchronizationState.SYNCHRONIZING],
    ).toContain(KnowledgeSynchronizationState.EXPIRED);
  });
});

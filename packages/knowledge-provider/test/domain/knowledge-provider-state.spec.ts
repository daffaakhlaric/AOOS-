import { describe, expect, it } from "vitest";

import {
  KNOWLEDGE_PROVIDER_SETTLED_STATES,
  KNOWLEDGE_PROVIDER_STATE_TRANSITIONS,
  KNOWLEDGE_PROVIDER_TERMINAL_STATES,
  KnowledgeProviderState,
} from "../../src/domain/knowledge-provider-state.js";

describe("KnowledgeProviderState", () => {
  it("has exactly 10 lifecycle states", () => {
    expect(Object.values(KnowledgeProviderState)).toHaveLength(10);
  });

  it("defines a transition table entry for every state", () => {
    for (const state of Object.values(KnowledgeProviderState)) {
      expect(KNOWLEDGE_PROVIDER_STATE_TRANSITIONS[state]).toBeDefined();
    }
  });

  it("allows REGISTERED to transition to VALIDATED or FAILED", () => {
    expect(KNOWLEDGE_PROVIDER_STATE_TRANSITIONS[KnowledgeProviderState.REGISTERED]).toEqual([
      KnowledgeProviderState.VALIDATED,
      KnowledgeProviderState.FAILED,
    ]);
  });

  it("marks only DESTROYED as hard-terminal with no outgoing edges", () => {
    expect(KNOWLEDGE_PROVIDER_TERMINAL_STATES.has(KnowledgeProviderState.DESTROYED)).toBe(true);
    expect(KNOWLEDGE_PROVIDER_STATE_TRANSITIONS[KnowledgeProviderState.DESTROYED]).toEqual([]);
  });

  it("does not mark FAILED as hard-terminal even though it is settled", () => {
    expect(KNOWLEDGE_PROVIDER_TERMINAL_STATES.has(KnowledgeProviderState.FAILED)).toBe(false);
    expect(KNOWLEDGE_PROVIDER_STATE_TRANSITIONS[KnowledgeProviderState.FAILED]).toEqual([
      KnowledgeProviderState.DESTROYED,
    ]);
  });

  it("marks DISCONNECTED/DISABLED/FAILED/DESTROYED as settled", () => {
    for (const state of [
      KnowledgeProviderState.DISCONNECTED,
      KnowledgeProviderState.DISABLED,
      KnowledgeProviderState.FAILED,
      KnowledgeProviderState.DESTROYED,
    ]) {
      expect(KNOWLEDGE_PROVIDER_SETTLED_STATES.has(state)).toBe(true);
    }
  });

  it("does not mark intermediate states as settled", () => {
    for (const state of [
      KnowledgeProviderState.REGISTERED,
      KnowledgeProviderState.VALIDATED,
      KnowledgeProviderState.CONFIGURED,
      KnowledgeProviderState.CONNECTED,
      KnowledgeProviderState.READY,
      KnowledgeProviderState.SYNCHRONIZING,
    ]) {
      expect(KNOWLEDGE_PROVIDER_SETTLED_STATES.has(state)).toBe(false);
    }
  });

  it("allows READY to transition to SYNCHRONIZING, DISABLED, DISCONNECTED, or FAILED", () => {
    expect(KNOWLEDGE_PROVIDER_STATE_TRANSITIONS[KnowledgeProviderState.READY]).toEqual([
      KnowledgeProviderState.SYNCHRONIZING,
      KnowledgeProviderState.DISABLED,
      KnowledgeProviderState.DISCONNECTED,
      KnowledgeProviderState.FAILED,
    ]);
  });

  it("allows DISCONNECTED to reconnect to CONNECTED", () => {
    expect(KNOWLEDGE_PROVIDER_STATE_TRANSITIONS[KnowledgeProviderState.DISCONNECTED]).toContain(
      KnowledgeProviderState.CONNECTED,
    );
  });

  it("allows DISABLED to re-enable to READY", () => {
    expect(KNOWLEDGE_PROVIDER_STATE_TRANSITIONS[KnowledgeProviderState.DISABLED]).toContain(
      KnowledgeProviderState.READY,
    );
  });
});

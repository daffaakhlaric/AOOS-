/** "PROVIDER LIFECYCLE" (docs/PROMPT-005.7F-KNOWLEDGE-PROVIDER.md) — the full Knowledge Provider lifecycle. */
export enum KnowledgeProviderState {
  REGISTERED = "registered",
  VALIDATED = "validated",
  CONFIGURED = "configured",
  CONNECTED = "connected",
  READY = "ready",
  SYNCHRONIZING = "synchronizing",
  DISCONNECTED = "disconnected",
  DISABLED = "disabled",
  FAILED = "failed",
  DESTROYED = "destroyed",
}

/** The authoritative transition table — `state-machine/knowledge-provider-state-machine.ts` is the only code allowed to consult this to decide whether a transition is legal. */
export const KNOWLEDGE_PROVIDER_STATE_TRANSITIONS: Readonly<
  Record<KnowledgeProviderState, readonly KnowledgeProviderState[]>
> = {
  [KnowledgeProviderState.REGISTERED]: [
    KnowledgeProviderState.VALIDATED,
    KnowledgeProviderState.FAILED,
  ],
  [KnowledgeProviderState.VALIDATED]: [
    KnowledgeProviderState.CONFIGURED,
    KnowledgeProviderState.FAILED,
  ],
  [KnowledgeProviderState.CONFIGURED]: [
    KnowledgeProviderState.CONNECTED,
    KnowledgeProviderState.FAILED,
  ],
  [KnowledgeProviderState.CONNECTED]: [
    KnowledgeProviderState.READY,
    KnowledgeProviderState.DISCONNECTED,
    KnowledgeProviderState.FAILED,
  ],
  [KnowledgeProviderState.READY]: [
    KnowledgeProviderState.SYNCHRONIZING,
    KnowledgeProviderState.DISABLED,
    KnowledgeProviderState.DISCONNECTED,
    KnowledgeProviderState.FAILED,
  ],
  [KnowledgeProviderState.SYNCHRONIZING]: [
    KnowledgeProviderState.READY,
    KnowledgeProviderState.FAILED,
    KnowledgeProviderState.DISCONNECTED,
  ],
  [KnowledgeProviderState.DISCONNECTED]: [
    KnowledgeProviderState.CONNECTED,
    KnowledgeProviderState.DESTROYED,
  ],
  [KnowledgeProviderState.DISABLED]: [
    KnowledgeProviderState.READY,
    KnowledgeProviderState.DESTROYED,
  ],
  [KnowledgeProviderState.FAILED]: [KnowledgeProviderState.DESTROYED],
  [KnowledgeProviderState.DESTROYED]: [],
};

/** The single hard-terminal state (no outgoing edges) — mirrors `@aos/knowledge-synchronization`'s "Destroy" precedent. */
export const KNOWLEDGE_PROVIDER_TERMINAL_STATES: ReadonlySet<KnowledgeProviderState> = new Set([
  KnowledgeProviderState.DESTROYED,
]);

/** States a Provider is "no longer actively progressing" in — a metrics/health categorization, not a state-machine rule. */
export const KNOWLEDGE_PROVIDER_SETTLED_STATES: ReadonlySet<KnowledgeProviderState> = new Set([
  KnowledgeProviderState.DISCONNECTED,
  KnowledgeProviderState.DISABLED,
  KnowledgeProviderState.FAILED,
  KnowledgeProviderState.DESTROYED,
]);

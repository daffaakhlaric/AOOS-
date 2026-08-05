/** "SYNCHRONIZATION LIFECYCLE" (docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md) — the full Knowledge Synchronization lifecycle. */
export enum KnowledgeSynchronizationState {
  CREATED = "created",
  QUEUED = "queued",
  PREPARING = "preparing",
  CONNECTING = "connecting",
  SYNCHRONIZING = "synchronizing",
  VALIDATING = "validating",
  COMMITTING = "committing",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  RETRYING = "retrying",
  EXPIRED = "expired",
  DESTROYED = "destroyed",
}

/** The authoritative transition table — `state-machine/knowledge-synchronization-state-machine.ts` is the only code allowed to consult this to decide whether a transition is legal. */
export const KNOWLEDGE_SYNCHRONIZATION_STATE_TRANSITIONS: Readonly<
  Record<KnowledgeSynchronizationState, readonly KnowledgeSynchronizationState[]>
> = {
  [KnowledgeSynchronizationState.CREATED]: [
    KnowledgeSynchronizationState.QUEUED,
    KnowledgeSynchronizationState.CANCELLED,
  ],
  [KnowledgeSynchronizationState.QUEUED]: [
    KnowledgeSynchronizationState.PREPARING,
    KnowledgeSynchronizationState.FAILED,
    KnowledgeSynchronizationState.CANCELLED,
  ],
  [KnowledgeSynchronizationState.PREPARING]: [
    KnowledgeSynchronizationState.CONNECTING,
    KnowledgeSynchronizationState.FAILED,
    KnowledgeSynchronizationState.CANCELLED,
  ],
  [KnowledgeSynchronizationState.CONNECTING]: [
    KnowledgeSynchronizationState.SYNCHRONIZING,
    KnowledgeSynchronizationState.FAILED,
    KnowledgeSynchronizationState.CANCELLED,
  ],
  [KnowledgeSynchronizationState.SYNCHRONIZING]: [
    KnowledgeSynchronizationState.VALIDATING,
    KnowledgeSynchronizationState.FAILED,
    KnowledgeSynchronizationState.CANCELLED,
    KnowledgeSynchronizationState.EXPIRED,
  ],
  [KnowledgeSynchronizationState.VALIDATING]: [
    KnowledgeSynchronizationState.COMMITTING,
    KnowledgeSynchronizationState.FAILED,
    KnowledgeSynchronizationState.CANCELLED,
  ],
  [KnowledgeSynchronizationState.COMMITTING]: [
    KnowledgeSynchronizationState.COMPLETED,
    KnowledgeSynchronizationState.FAILED,
    KnowledgeSynchronizationState.CANCELLED,
  ],
  [KnowledgeSynchronizationState.COMPLETED]: [KnowledgeSynchronizationState.DESTROYED],
  [KnowledgeSynchronizationState.FAILED]: [
    KnowledgeSynchronizationState.RETRYING,
    KnowledgeSynchronizationState.DESTROYED,
  ],
  [KnowledgeSynchronizationState.CANCELLED]: [KnowledgeSynchronizationState.DESTROYED],
  [KnowledgeSynchronizationState.RETRYING]: [
    KnowledgeSynchronizationState.PREPARING,
    KnowledgeSynchronizationState.DESTROYED,
  ],
  [KnowledgeSynchronizationState.EXPIRED]: [KnowledgeSynchronizationState.DESTROYED],
  [KnowledgeSynchronizationState.DESTROYED]: [],
};

/** The single hard-terminal state (no outgoing edges) — mirrors `@aos/knowledge-runtime`'s/`@aos/knowledge-indexing`'s "Destroy" precedent. Completed/Failed/Cancelled/Expired are "settled" but can still be Destroyed. */
export const KNOWLEDGE_SYNCHRONIZATION_TERMINAL_STATES: ReadonlySet<KnowledgeSynchronizationState> =
  new Set([KnowledgeSynchronizationState.DESTROYED]);

/** States a Synchronization is "no longer actively running" in — a metrics/health categorization, not a state-machine rule. */
export const KNOWLEDGE_SYNCHRONIZATION_SETTLED_STATES: ReadonlySet<KnowledgeSynchronizationState> =
  new Set([
    KnowledgeSynchronizationState.COMPLETED,
    KnowledgeSynchronizationState.FAILED,
    KnowledgeSynchronizationState.CANCELLED,
    KnowledgeSynchronizationState.EXPIRED,
    KnowledgeSynchronizationState.DESTROYED,
  ]);

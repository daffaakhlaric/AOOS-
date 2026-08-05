/** "RETRIEVAL LIFECYCLE" (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md) — the full Knowledge Retrieval lifecycle. */
export enum KnowledgeRetrievalState {
  CREATED = "created",
  VALIDATING = "validating",
  RESOLVING = "resolving",
  SEARCHING = "searching",
  RANKING = "ranking",
  FILTERING = "filtering",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
}

/** The authoritative transition table — `state-machine/knowledge-retrieval-state-machine.ts` is the only code allowed to consult this to decide whether a transition is legal. */
export const KNOWLEDGE_RETRIEVAL_STATE_TRANSITIONS: Readonly<
  Record<KnowledgeRetrievalState, readonly KnowledgeRetrievalState[]>
> = {
  [KnowledgeRetrievalState.CREATED]: [
    KnowledgeRetrievalState.VALIDATING,
    KnowledgeRetrievalState.CANCELLED,
  ],
  [KnowledgeRetrievalState.VALIDATING]: [
    KnowledgeRetrievalState.RESOLVING,
    KnowledgeRetrievalState.FAILED,
    KnowledgeRetrievalState.CANCELLED,
  ],
  [KnowledgeRetrievalState.RESOLVING]: [
    KnowledgeRetrievalState.SEARCHING,
    KnowledgeRetrievalState.FAILED,
    KnowledgeRetrievalState.CANCELLED,
  ],
  [KnowledgeRetrievalState.SEARCHING]: [
    KnowledgeRetrievalState.RANKING,
    KnowledgeRetrievalState.FAILED,
    KnowledgeRetrievalState.CANCELLED,
    KnowledgeRetrievalState.EXPIRED,
  ],
  [KnowledgeRetrievalState.RANKING]: [
    KnowledgeRetrievalState.FILTERING,
    KnowledgeRetrievalState.FAILED,
    KnowledgeRetrievalState.CANCELLED,
  ],
  [KnowledgeRetrievalState.FILTERING]: [
    KnowledgeRetrievalState.COMPLETED,
    KnowledgeRetrievalState.FAILED,
    KnowledgeRetrievalState.CANCELLED,
  ],
  [KnowledgeRetrievalState.COMPLETED]: [],
  [KnowledgeRetrievalState.FAILED]: [],
  [KnowledgeRetrievalState.CANCELLED]: [],
  [KnowledgeRetrievalState.EXPIRED]: [],
};

/** States a `KnowledgeRetrieval` is "no longer actively executing" in — a metrics/health categorization, not a state-machine rule. */
export const KNOWLEDGE_RETRIEVAL_TERMINAL_STATES: ReadonlySet<KnowledgeRetrievalState> = new Set([
  KnowledgeRetrievalState.COMPLETED,
  KnowledgeRetrievalState.FAILED,
  KnowledgeRetrievalState.CANCELLED,
  KnowledgeRetrievalState.EXPIRED,
]);

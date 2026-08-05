/** The small state set a `KnowledgeSynchronizationSession` record moves through — mirrors `@aos/knowledge-retrieval`'s `KnowledgeQuerySessionState`. */
export enum KnowledgeSynchronizationSessionState {
  OPEN = "open",
  CLOSED = "closed",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
}

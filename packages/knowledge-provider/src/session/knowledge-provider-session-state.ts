/** The small state set a `KnowledgeProviderSession` record moves through — mirrors `@aos/knowledge-synchronization`'s `KnowledgeSynchronizationSessionState`. */
export enum KnowledgeProviderSessionState {
  OPEN = "open",
  CLOSED = "closed",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
}

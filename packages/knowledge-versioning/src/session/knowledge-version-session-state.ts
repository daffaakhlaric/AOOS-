/** The small state set a `KnowledgeVersionSession` record moves through. */
export enum KnowledgeVersionSessionState {
  OPEN = "open",
  CLOSED = "closed",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
}

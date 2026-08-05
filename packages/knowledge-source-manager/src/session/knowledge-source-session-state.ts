/** The small state set a `KnowledgeSourceSession` record moves through. */
export enum KnowledgeSourceSessionState {
  OPEN = "open",
  CLOSED = "closed",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
}

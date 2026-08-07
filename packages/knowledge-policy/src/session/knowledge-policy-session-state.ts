/** The small state set a `KnowledgePolicySession` record moves through. */
export enum KnowledgePolicySessionState {
  OPEN = "open",
  CLOSED = "closed",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
}

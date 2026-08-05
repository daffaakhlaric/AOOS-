/** "RUNTIME SESSION: KnowledgeQuerySession. Supports Open, Resume, Close, Cancel, Expire, Renew." (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md) — the small state set a `KnowledgeQuerySession` record moves through. */
export enum KnowledgeQuerySessionState {
  OPEN = "open",
  CLOSED = "closed",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
}

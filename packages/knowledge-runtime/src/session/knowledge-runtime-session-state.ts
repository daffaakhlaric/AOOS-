/** "RUNTIME SESSION: Supports Open, Close, Suspend, Resume, Renew, Expire, Destroy." (docs/PROMPT-005.7B-KNOWLEDGE-RUNTIME.md) — the small state set a `KnowledgeRuntimeSession` record moves through, independent of its underlying `KnowledgeRuntimeInstance`'s own `KnowledgeRuntimeState`. */
export enum KnowledgeRuntimeSessionState {
  OPEN = "open",
  SUSPENDED = "suspended",
  CLOSED = "closed",
  EXPIRED = "expired",
  DESTROYED = "destroyed",
}

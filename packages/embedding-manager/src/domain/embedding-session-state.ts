/** Business-level session states — distinct from `EmbeddingState`. Mirrors the OPEN/CLOSED/CANCELLED/EXPIRED convention established by every prior sibling package. */
export enum EmbeddingSessionState {
  OPEN = "open",
  CLOSED = "closed",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
}

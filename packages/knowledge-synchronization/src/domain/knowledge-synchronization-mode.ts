/** "SYNCHRONIZATION MODES" (docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md) — the 7 modes a `KnowledgeSynchronizationJob` can run under. Real-Time/Webhook/Streaming are "interface only" — no scheduler/pipeline logic in this package ever drives them end-to-end. */
export enum KnowledgeSynchronizationMode {
  MANUAL = "manual",
  SCHEDULED = "scheduled",
  INCREMENTAL = "incremental",
  FULL = "full",
  REAL_TIME = "real_time",
  WEBHOOK = "webhook",
  STREAMING = "streaming",
}

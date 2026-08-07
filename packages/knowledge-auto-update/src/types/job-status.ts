/** Lifecycle status of a `KnowledgeUpdateJob`. */
export enum KnowledgeUpdateJobStatus {
  Pending = "pending",
  Scheduled = "scheduled",
  Running = "running",
  RetryScheduled = "retry_scheduled",
  Completed = "completed",
  Failed = "failed",
  Cancelled = "cancelled",
  Paused = "paused",
  Expired = "expired",
}

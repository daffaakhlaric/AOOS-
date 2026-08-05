/** Every Job state change publishes one of these onto the Event Bus (docs/PROMPT-005.5-ENTERPRISE-SCHEDULER.md — "EVENT BUS"). */
export enum SchedulerJobEventType {
  CREATED = "scheduler.job.created",
  UPDATED = "scheduler.job.updated",
  DELETED = "scheduler.job.deleted",
  READY = "scheduler.job.ready",
  STARTED = "scheduler.job.started",
  COMPLETED = "scheduler.job.completed",
  FAILED = "scheduler.job.failed",
  RETRY = "scheduler.job.retry",
  PAUSED = "scheduler.job.paused",
  RESUMED = "scheduler.job.resumed",
  CANCELLED = "scheduler.job.cancelled",
  EXPIRED = "scheduler.job.expired",
}

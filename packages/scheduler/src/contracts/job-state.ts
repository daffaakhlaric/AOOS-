/** Job State (docs/PROMPT-005.5-ENTERPRISE-SCHEDULER.md — "Job State"). */
export enum JobState {
  PENDING = "pending",
  WAITING = "waiting",
  READY = "ready",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  RETRYING = "retrying",
  PAUSED = "paused",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
}

/**
 * The Job State Machine's valid transitions. `COMPLETED`/`CANCELLED`/`EXPIRED` are
 * terminal — nothing transitions out of them.
 */
export const JOB_STATE_TRANSITIONS: Readonly<Record<JobState, readonly JobState[]>> = {
  [JobState.PENDING]: [JobState.WAITING, JobState.CANCELLED],
  [JobState.WAITING]: [JobState.READY, JobState.PAUSED, JobState.CANCELLED, JobState.EXPIRED],
  [JobState.READY]: [JobState.RUNNING, JobState.CANCELLED, JobState.EXPIRED],
  [JobState.RUNNING]: [JobState.COMPLETED, JobState.FAILED, JobState.CANCELLED],
  [JobState.FAILED]: [JobState.RETRYING, JobState.EXPIRED, JobState.CANCELLED],
  [JobState.RETRYING]: [JobState.READY, JobState.EXPIRED, JobState.CANCELLED],
  [JobState.PAUSED]: [JobState.WAITING, JobState.CANCELLED],
  [JobState.COMPLETED]: [],
  [JobState.CANCELLED]: [],
  [JobState.EXPIRED]: [],
};

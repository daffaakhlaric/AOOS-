/** Job Priority (docs/PROMPT-005.5-ENTERPRISE-SCHEDULER.md) — drives Queue drain order. */
export enum JobPriority {
  CRITICAL = "critical",
  HIGH = "high",
  NORMAL = "normal",
  LOW = "low",
  BACKGROUND = "background",
}

/** Highest priority first — the order the Priority Queue (queue/job-priority-queue.ts) drains in. */
export const JOB_PRIORITY_ORDER: readonly JobPriority[] = [
  JobPriority.CRITICAL,
  JobPriority.HIGH,
  JobPriority.NORMAL,
  JobPriority.LOW,
  JobPriority.BACKGROUND,
];

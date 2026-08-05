import type { PublishInput } from "./i-publisher.js";

/**
 * Scheduled Publish port (docs/PROMPT-005.4-ENTERPRISE-EVENT-BUS.md — "interface only").
 * No implementation ships in this package — cron/calendar-based publish requires the
 * Scheduler, which is explicitly out of scope for this Engineering Task
 * (ENGINEERING TASK 005.5).
 */
export interface IScheduledPublisher {
  publishScheduled(
    input: PublishInput,
    cronExpression: string,
  ): Promise<{ readonly scheduleId: string }>;
  cancelScheduled(scheduleId: string): Promise<void>;
}

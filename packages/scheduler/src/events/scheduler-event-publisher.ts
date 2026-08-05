import { EventCategory, type IPublisher } from "@aos/event-bus";

import type { JobRecord } from "../entities/job.js";

import type { SchedulerJobEventType } from "./scheduler-job-event-type.js";

/**
 * "Semua perubahan Job WAJIB Publish Event" (docs/PROMPT-005.5-ENTERPRISE-SCHEDULER.md).
 * Publishes onto the real `@aos/event-bus` `IPublisher` — the Scheduler never calls any
 * downstream Runtime directly, per the Objective's explicit constraint ("Scheduler hanya
 * menerbitkan Event").
 */
export class SchedulerEventPublisher {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "scheduler",
  ) {}

  async publishJobEvent(
    type: SchedulerJobEventType,
    job: JobRecord,
    extra: Readonly<Record<string, unknown>> = {},
  ): Promise<void> {
    await this.publisher.publish({
      type,
      category: EventCategory.DOMAIN,
      payload: {
        jobId: job.jobId,
        name: job.name,
        state: job.state,
        priority: job.priority,
        scheduleType: job.schedule.type,
        ...extra,
      },
      source: this.source,
      producer: "@aos/scheduler",
      tenantId: job.tenantId,
    });
  }
}

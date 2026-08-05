import type { IClockProvider } from "../clock/i-clock-provider.js";
import { JobState } from "../contracts/job-state.js";
import type { IRetryPolicy, RetryMetadata } from "../contracts/retry-policy.js";
import { TriggerType } from "../contracts/trigger-type.js";
import type { JobRecord } from "../entities/job.js";
import { RetryExhaustedException } from "../errors/retry-exhausted-exception.js";
import { SchedulerException } from "../errors/scheduler-exception.js";
import type { IScheduleStore } from "../store-interface/i-schedule-store.js";

import type { ITrigger } from "./i-trigger.js";

/** Retry Trigger — schedules a Failed Job's next retry attempt under its Retry Policy, or raises `RetryExhaustedException` once `maxAttempts` is reached. */
export class RetryTrigger implements ITrigger {
  readonly type = TriggerType.RETRY;

  constructor(
    private readonly store: IScheduleStore,
    private readonly clock: IClockProvider,
  ) {}

  async scheduleRetry(jobId: string, policy: IRetryPolicy, error: string): Promise<JobRecord> {
    const job = await this.store.get(jobId);
    if (!job) {
      throw new SchedulerException(`Cannot schedule retry for "${jobId}": not found`);
    }

    const attempt = (job.retryMetadata?.attempt ?? 0) + 1;
    if (attempt > policy.maxAttempts) {
      throw new RetryExhaustedException(
        `Job "${jobId}" exhausted its Retry Policy after ${policy.maxAttempts} attempt(s)`,
      );
    }

    const now = this.clock.now();
    const nextRetryAt = new Date(now.getTime() + policy.nextDelayMs(attempt)).toISOString();
    const retryMetadata: RetryMetadata = {
      attempt,
      maxAttempts: policy.maxAttempts,
      lastError: error,
      nextRetryAt,
    };

    return this.store.update(jobId, {
      state: JobState.RETRYING,
      retryMetadata,
      nextFireAt: nextRetryAt,
      updatedAt: now.toISOString(),
      changelog: [...job.changelog, JobState.RETRYING],
    });
  }
}

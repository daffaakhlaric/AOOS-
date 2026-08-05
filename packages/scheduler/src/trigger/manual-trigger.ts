import type { IClockProvider } from "../clock/i-clock-provider.js";
import { JOB_STATE_TRANSITIONS, JobState } from "../contracts/job-state.js";
import { ScheduleType } from "../contracts/schedule-type.js";
import { TriggerType } from "../contracts/trigger-type.js";
import type { JobRecord } from "../entities/job.js";
import { SchedulerException } from "../errors/scheduler-exception.js";
import { StateTransitionException } from "../errors/state-transition-exception.js";
import type { IScheduleStore } from "../store-interface/i-schedule-store.js";

import type { ITrigger } from "./i-trigger.js";

/** Manual Trigger — the only way a `ScheduleType.MANUAL` Job ever becomes Ready. */
export class ManualTrigger implements ITrigger {
  readonly type = TriggerType.MANUAL;

  constructor(
    private readonly store: IScheduleStore,
    private readonly clock: IClockProvider,
  ) {}

  async fire(jobId: string): Promise<JobRecord> {
    const job = await this.store.get(jobId);
    if (!job) {
      throw new SchedulerException(`Cannot fire "${jobId}": not found`);
    }
    if (job.schedule.type !== ScheduleType.MANUAL) {
      throw new SchedulerException(
        `Cannot manually fire "${jobId}": schedule type is "${job.schedule.type}", not "manual"`,
      );
    }
    if (!JOB_STATE_TRANSITIONS[job.state].includes(JobState.READY)) {
      throw new StateTransitionException(
        `Cannot fire "${jobId}": no valid transition from "${job.state}" to "ready"`,
      );
    }

    const now = this.clock.now();
    return this.store.update(jobId, {
      state: JobState.READY,
      updatedAt: now.toISOString(),
      changelog: [...job.changelog, JobState.READY],
    });
  }
}

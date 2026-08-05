import type { IClockProvider } from "../clock/i-clock-provider.js";
import { JobState } from "../contracts/job-state.js";
import { ScheduleType } from "../contracts/schedule-type.js";
import { TriggerType } from "../contracts/trigger-type.js";
import type { JobRecord } from "../entities/job.js";
import type { IScheduleStore } from "../store-interface/i-schedule-store.js";

import type { ITrigger } from "./i-trigger.js";

/** Dependency Trigger — re-checks every dependent Job when `completedJobId` finishes, readying any whose dependencies are now all satisfied ("Job Dependency", "Chain Dependency"). */
export class DependencyTrigger implements ITrigger {
  readonly type = TriggerType.DEPENDENCY;

  constructor(
    private readonly store: IScheduleStore,
    private readonly clock: IClockProvider,
  ) {}

  async onJobCompleted(completedJobId: string): Promise<readonly JobRecord[]> {
    const dependents = await this.store.listDependents(completedJobId);
    const readied: JobRecord[] = [];

    for (const dependent of dependents) {
      if (
        dependent.schedule.type !== ScheduleType.DEPENDENCY ||
        dependent.state !== JobState.WAITING
      ) {
        continue;
      }
      const dependencies = await Promise.all(
        dependent.schedule.dependsOnJobIds.map((id) => this.store.get(id)),
      );
      const allCompleted = dependencies.every((dep) => dep?.state === JobState.COMPLETED);
      if (!allCompleted) {
        continue;
      }
      const now = this.clock.now();
      readied.push(
        await this.store.update(dependent.jobId, {
          state: JobState.READY,
          updatedAt: now.toISOString(),
          changelog: [...dependent.changelog, JobState.READY],
        }),
      );
    }
    return readied;
  }
}

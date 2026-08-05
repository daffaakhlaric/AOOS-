import { JobPriority } from "../../src/contracts/job-priority.js";
import { JobState } from "../../src/contracts/job-state.js";
import { ScheduleType } from "../../src/contracts/schedule-type.js";
import { TriggerType } from "../../src/contracts/trigger-type.js";
import type { JobRecord } from "../../src/entities/job.js";

/** A minimal, valid JobRecord for tests that don't care about the specific Schedule shape. */
export function jobFixture(overrides: Partial<JobRecord> = {}): JobRecord {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    jobId: "job-1",
    name: "test-job",
    schedule: { type: ScheduleType.MANUAL, timezone: "UTC" },
    priority: JobPriority.NORMAL,
    state: JobState.WAITING,
    triggerType: TriggerType.MANUAL,
    createdAt: now,
    updatedAt: now,
    changelog: [JobState.PENDING, JobState.WAITING],
    ...overrides,
  };
}

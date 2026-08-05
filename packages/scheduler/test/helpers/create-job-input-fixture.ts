import { ScheduleType } from "../../src/contracts/schedule-type.js";
import type { CreateJobInput } from "../../src/entities/job.js";

export function createJobInputFixture(overrides: Partial<CreateJobInput> = {}): CreateJobInput {
  return {
    name: "test-job",
    schedule: { type: ScheduleType.MANUAL, timezone: "UTC" },
    ...overrides,
  };
}

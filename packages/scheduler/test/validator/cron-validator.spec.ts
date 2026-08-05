import { describe, expect, it } from "vitest";

import { ScheduleType } from "../../src/contracts/schedule-type.js";
import { CronValidator } from "../../src/validator/cron-validator.js";
import { createJobInputFixture } from "../helpers/create-job-input-fixture.js";

describe("Cron Parser Test — CronValidator", () => {
  it("passes non-cron schedules unconditionally", () => {
    expect(new CronValidator().validate(createJobInputFixture(), {}).valid).toBe(true);
  });

  it("passes a valid cron expression", () => {
    const input = createJobInputFixture({
      schedule: { type: ScheduleType.CRON, timezone: "UTC", expression: "0 9 * * *" },
    });
    expect(new CronValidator().validate(input, {}).valid).toBe(true);
  });

  it("fails an invalid cron expression", () => {
    const input = createJobInputFixture({
      schedule: { type: ScheduleType.CRON, timezone: "UTC", expression: "not a cron" },
    });
    const result = new CronValidator().validate(input, {});
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toBe("schedule.expression");
  });
});

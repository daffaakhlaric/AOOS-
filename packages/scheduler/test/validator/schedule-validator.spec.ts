import { describe, expect, it } from "vitest";

import { ScheduleType } from "../../src/contracts/schedule-type.js";
import { ScheduleValidator } from "../../src/validator/schedule-validator.js";
import { createJobInputFixture } from "../helpers/create-job-input-fixture.js";

describe("Validation Test — ScheduleValidator", () => {
  it("passes a well-formed schedule", () => {
    expect(new ScheduleValidator().validate(createJobInputFixture(), {}).valid).toBe(true);
  });

  it("fails a malformed schedule", () => {
    const input = createJobInputFixture({
      schedule: { type: ScheduleType.INTERVAL, timezone: "UTC", everyMs: -1 } as never,
    });
    const result = new ScheduleValidator().validate(input, {});
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toContain("schedule.");
  });
});

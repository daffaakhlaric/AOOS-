import { describe, expect, it } from "vitest";

import { TimezoneValidator } from "../../src/validator/timezone-validator.js";
import { createJobInputFixture } from "../helpers/create-job-input-fixture.js";

describe("Timezone Test — TimezoneValidator", () => {
  it("accepts a valid IANA timezone", () => {
    const input = createJobInputFixture({
      schedule: { type: "manual" as never, timezone: "Asia/Jakarta" },
    });
    expect(new TimezoneValidator().validate(input, {}).valid).toBe(true);
  });

  it("accepts UTC", () => {
    expect(new TimezoneValidator().validate(createJobInputFixture(), {}).valid).toBe(true);
  });

  it("rejects an invalid timezone name", () => {
    const input = createJobInputFixture({
      schedule: { type: "manual" as never, timezone: "Not/A_Timezone" },
    });
    const result = new TimezoneValidator().validate(input, {});
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toBe("schedule.timezone");
  });
});

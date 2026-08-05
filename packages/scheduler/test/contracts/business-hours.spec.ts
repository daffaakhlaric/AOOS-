import { describe, expect, it } from "vitest";

import { businessHoursConfigSchema } from "../../src/contracts/business-hours.js";

describe("Business Hour Test — businessHoursConfigSchema", () => {
  it("accepts a full config", () => {
    expect(
      businessHoursConfigSchema.safeParse({
        timezone: "UTC",
        workDays: [1, 2, 3, 4, 5],
        workStart: "09:00",
        workEnd: "17:00",
        lunchStart: "12:00",
        lunchEnd: "13:00",
      }).success,
    ).toBe(true);
  });

  it("applies sensible defaults when omitted", () => {
    const result = businessHoursConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timezone).toBe("UTC");
      expect(result.data.workDays).toEqual([1, 2, 3, 4, 5]);
      expect(result.data.workStart).toBe("09:00");
      expect(result.data.workEnd).toBe("17:00");
    }
  });

  it("rejects a malformed HH:mm value", () => {
    expect(businessHoursConfigSchema.safeParse({ workStart: "9am" }).success).toBe(false);
  });

  it("rejects a day-of-week out of range", () => {
    expect(businessHoursConfigSchema.safeParse({ workDays: [7] }).success).toBe(false);
  });
});

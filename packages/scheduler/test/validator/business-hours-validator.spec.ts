import { describe, expect, it } from "vitest";

import { validateBusinessHoursConfig } from "../../src/validator/business-hours-validator.js";

const validConfig = {
  timezone: "UTC",
  workDays: [1, 2, 3, 4, 5],
  workStart: "09:00",
  workEnd: "17:00",
  lunchStart: "12:00",
  lunchEnd: "13:00",
};

describe("Business Hour Test — validateBusinessHoursConfig", () => {
  it("accepts a well-formed config", () => {
    expect(validateBusinessHoursConfig(validConfig).valid).toBe(true);
  });

  it("accepts a config with no lunch break", () => {
    expect(
      validateBusinessHoursConfig({ ...validConfig, lunchStart: undefined, lunchEnd: undefined })
        .valid,
    ).toBe(true);
  });

  it("rejects workStart >= workEnd", () => {
    const result = validateBusinessHoursConfig({
      ...validConfig,
      workStart: "17:00",
      workEnd: "09:00",
    });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toBe("workStart");
  });

  it("rejects lunchStart >= lunchEnd", () => {
    const result = validateBusinessHoursConfig({
      ...validConfig,
      lunchStart: "13:00",
      lunchEnd: "12:00",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a lunch break outside working hours", () => {
    const result = validateBusinessHoursConfig({
      ...validConfig,
      lunchStart: "08:00",
      lunchEnd: "08:30",
    });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain("working hours");
  });

  it("rejects an empty workDays list", () => {
    const result = validateBusinessHoursConfig({ ...validConfig, workDays: [] });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "workDays")).toBe(true);
  });
});

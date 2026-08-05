import { describe, expect, it } from "vitest";

import { JobPriority } from "../../src/contracts/job-priority.js";
import { BusinessHoursPolicy } from "../../src/policy/business-hours-policy.js";

const config = {
  timezone: "UTC",
  workDays: [1, 2, 3, 4, 5],
  workStart: "09:00",
  workEnd: "17:00",
  lunchStart: "12:00",
  lunchEnd: "13:00",
};

function context(now: Date) {
  return { jobId: "job-1", priority: JobPriority.NORMAL, now };
}

describe("Business Hour Test — BusinessHoursPolicy", () => {
  it("allows a weekday within working hours, outside lunch", () => {
    // 2026-01-05 is a Monday.
    const policy = new BusinessHoursPolicy(config);
    expect(policy.evaluate(context(new Date("2026-01-05T10:00:00.000Z"))).allowed).toBe(true);
  });

  it("denies a weekend", () => {
    // 2026-01-04 is a Sunday.
    const policy = new BusinessHoursPolicy(config);
    const decision = policy.evaluate(context(new Date("2026-01-04T10:00:00.000Z")));
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("weekend");
  });

  it("denies before working hours start", () => {
    const policy = new BusinessHoursPolicy(config);
    const decision = policy.evaluate(context(new Date("2026-01-05T07:00:00.000Z")));
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("working hours");
  });

  it("denies at/after working hours end", () => {
    const policy = new BusinessHoursPolicy(config);
    expect(policy.evaluate(context(new Date("2026-01-05T17:00:00.000Z"))).allowed).toBe(false);
  });

  it("denies during the lunch break", () => {
    const policy = new BusinessHoursPolicy(config);
    const decision = policy.evaluate(context(new Date("2026-01-05T12:30:00.000Z")));
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("lunch");
  });

  it("allows through when no lunch break is configured", () => {
    const policy = new BusinessHoursPolicy({
      ...config,
      lunchStart: undefined,
      lunchEnd: undefined,
    });
    expect(policy.evaluate(context(new Date("2026-01-05T12:30:00.000Z"))).allowed).toBe(true);
  });

  it("evaluates in the configured timezone, not UTC", () => {
    // 13:00 UTC is 20:00 in Asia/Jakarta (UTC+7) — outside 09:00-17:00 local working hours.
    const policy = new BusinessHoursPolicy({ ...config, timezone: "Asia/Jakarta" });
    const decision = policy.evaluate(context(new Date("2026-01-05T13:00:00.000Z")));
    expect(decision.allowed).toBe(false);
  });
});

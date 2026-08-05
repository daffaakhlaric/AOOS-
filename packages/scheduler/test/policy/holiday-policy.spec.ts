import { describe, expect, it } from "vitest";

import { StaticHolidayProvider } from "../../src/calendar/static-holiday-provider.js";
import { JobPriority } from "../../src/contracts/job-priority.js";
import { HolidayPolicy } from "../../src/policy/holiday-policy.js";

describe("Holiday Test — HolidayPolicy", () => {
  it("denies dispatch on a configured holiday", async () => {
    const policy = new HolidayPolicy(new StaticHolidayProvider(["2026-01-01"]), "UTC");
    const decision = await policy.evaluate({
      jobId: "job-1",
      priority: JobPriority.NORMAL,
      now: new Date("2026-01-01T10:00:00.000Z"),
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("2026-01-01");
  });

  it("allows dispatch on a non-holiday", async () => {
    const policy = new HolidayPolicy(new StaticHolidayProvider(["2026-01-01"]), "UTC");
    const decision = await policy.evaluate({
      jobId: "job-1",
      priority: JobPriority.NORMAL,
      now: new Date("2026-06-15T10:00:00.000Z"),
    });
    expect(decision.allowed).toBe(true);
  });

  it("defaults to UTC when no timezone is given", async () => {
    const policy = new HolidayPolicy(new StaticHolidayProvider(["2026-01-01"]));
    const decision = await policy.evaluate({
      jobId: "job-1",
      priority: JobPriority.NORMAL,
      now: new Date("2026-01-01T10:00:00.000Z"),
    });
    expect(decision.allowed).toBe(false);
  });
});

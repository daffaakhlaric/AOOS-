import { describe, expect, it } from "vitest";

import { ScheduleType } from "../../src/contracts/schedule-type.js";
import { SchedulePlanner } from "../../src/planner/schedule-planner.js";

const planner = new SchedulePlanner();
const createdAt = new Date("2026-01-01T00:00:00.000Z");
const after = new Date("2026-01-01T00:00:00.000Z");

describe("SchedulePlanner — One Time", () => {
  it("returns fireAt when it is in the future", () => {
    const next = planner.computeNextFireTime(
      { type: ScheduleType.ONE_TIME, timezone: "UTC", fireAt: "2026-01-02T00:00:00.000Z" },
      { after, createdAt },
    );
    expect(next?.toISOString()).toBe("2026-01-02T00:00:00.000Z");
  });

  it("returns undefined once it has already fired", () => {
    const next = planner.computeNextFireTime(
      { type: ScheduleType.ONE_TIME, timezone: "UTC", fireAt: "2026-01-02T00:00:00.000Z" },
      { after, createdAt, lastFireAt: new Date("2026-01-02T00:00:00.000Z") },
    );
    expect(next).toBeUndefined();
  });

  it("returns undefined when fireAt is not strictly in the future", () => {
    const next = planner.computeNextFireTime(
      { type: ScheduleType.ONE_TIME, timezone: "UTC", fireAt: "2026-01-01T00:00:00.000Z" },
      { after, createdAt },
    );
    expect(next).toBeUndefined();
  });
});

describe("SchedulePlanner — Delayed", () => {
  it("fires delayMs after createdAt", () => {
    const next = planner.computeNextFireTime(
      { type: ScheduleType.DELAYED, timezone: "UTC", delayMs: 3_600_000 },
      { after, createdAt },
    );
    expect(next?.toISOString()).toBe("2026-01-01T01:00:00.000Z");
  });

  it("returns undefined once it has already fired", () => {
    const next = planner.computeNextFireTime(
      { type: ScheduleType.DELAYED, timezone: "UTC", delayMs: 3_600_000 },
      { after, createdAt, lastFireAt: new Date("2026-01-01T01:00:00.000Z") },
    );
    expect(next).toBeUndefined();
  });
});

describe("SchedulePlanner — Interval", () => {
  it("computes the next tick from createdAt when never fired", () => {
    const next = planner.computeNextFireTime(
      { type: ScheduleType.INTERVAL, timezone: "UTC", everyMs: 60_000 },
      { after, createdAt },
    );
    expect(next?.toISOString()).toBe("2026-01-01T00:01:00.000Z");
  });

  it("computes the next tick from lastFireAt when already fired once", () => {
    const next = planner.computeNextFireTime(
      { type: ScheduleType.INTERVAL, timezone: "UTC", everyMs: 60_000 },
      { after, createdAt, lastFireAt: new Date("2026-01-01T00:05:00.000Z") },
    );
    expect(next?.toISOString()).toBe("2026-01-01T00:06:00.000Z");
  });
});

describe("SchedulePlanner — Calendar", () => {
  it("picks the earliest date strictly after `after`", () => {
    const next = planner.computeNextFireTime(
      {
        type: ScheduleType.CALENDAR,
        timezone: "UTC",
        dates: ["2026-06-30T00:00:00.000Z", "2026-03-31T00:00:00.000Z", "2026-01-01T00:00:00.000Z"],
      },
      { after, createdAt },
    );
    expect(next?.toISOString()).toBe("2026-03-31T00:00:00.000Z");
  });

  it("returns undefined when every date is in the past", () => {
    const next = planner.computeNextFireTime(
      { type: ScheduleType.CALENDAR, timezone: "UTC", dates: ["2025-01-01T00:00:00.000Z"] },
      { after, createdAt },
    );
    expect(next).toBeUndefined();
  });
});

describe("SchedulePlanner — Cron and Recurring reuse the cron engine", () => {
  it("Cron: computes via nextCronFireTime", () => {
    const next = planner.computeNextFireTime(
      { type: ScheduleType.CRON, timezone: "UTC", expression: "0 9 * * *" },
      { after, createdAt },
    );
    expect(next?.toISOString()).toBe("2026-01-01T09:00:00.000Z");
  });

  it("Recurring: computes via recurringToCron + nextCronFireTime", () => {
    const next = planner.computeNextFireTime(
      { type: ScheduleType.RECURRING, timezone: "UTC", frequency: "daily", time: "09:00" },
      { after, createdAt },
    );
    expect(next?.toISOString()).toBe("2026-01-01T09:00:00.000Z");
  });
});

describe("SchedulePlanner — Dependency and Manual have no time component", () => {
  it("Dependency always returns undefined", () => {
    const next = planner.computeNextFireTime(
      { type: ScheduleType.DEPENDENCY, timezone: "UTC", dependsOnJobIds: ["job-1"] },
      { after, createdAt },
    );
    expect(next).toBeUndefined();
  });

  it("Manual always returns undefined", () => {
    const next = planner.computeNextFireTime(
      { type: ScheduleType.MANUAL, timezone: "UTC" },
      { after, createdAt },
    );
    expect(next).toBeUndefined();
  });
});

describe("SchedulePlanner — Execution Window (startAt/endAt) clamping", () => {
  it("startAt pushes the search floor forward", () => {
    const next = planner.computeNextFireTime(
      {
        type: ScheduleType.CRON,
        timezone: "UTC",
        expression: "0 9 * * *",
        startAt: "2026-01-03T00:00:00.000Z",
      },
      { after, createdAt },
    );
    expect(next?.toISOString()).toBe("2026-01-03T09:00:00.000Z");
  });

  it("endAt suppresses a candidate that falls after it", () => {
    const next = planner.computeNextFireTime(
      {
        type: ScheduleType.CRON,
        timezone: "UTC",
        expression: "0 9 * * *",
        endAt: "2026-01-01T00:00:00.000Z",
      },
      { after, createdAt },
    );
    expect(next).toBeUndefined();
  });

  it("endAt allows a candidate that falls at or before it", () => {
    const next = planner.computeNextFireTime(
      {
        type: ScheduleType.CRON,
        timezone: "UTC",
        expression: "0 9 * * *",
        endAt: "2026-01-01T09:00:00.000Z",
      },
      { after, createdAt },
    );
    expect(next?.toISOString()).toBe("2026-01-01T09:00:00.000Z");
  });
});

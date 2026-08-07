import { describe, expect, it } from "vitest";

import { ScheduleKind, type ScheduleDescriptor } from "../../src/types/schedule-descriptor.js";

describe("ScheduleKind", () => {
  it("defines exactly the 4 spec scheduling kinds", () => {
    expect(Object.values(ScheduleKind)).toHaveLength(4);
  });

  it("has no duplicate values", () => {
    const values = Object.values(ScheduleKind);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("ScheduleDescriptor shape discrimination", () => {
  it("narrows correctly by kind for Immediate", () => {
    const s: ScheduleDescriptor = { kind: ScheduleKind.Immediate };
    expect(s.kind).toBe(ScheduleKind.Immediate);
  });

  it("narrows correctly by kind for Scheduled", () => {
    const s: ScheduleDescriptor = { kind: ScheduleKind.Scheduled, runAt: 100 };
    if (s.kind === ScheduleKind.Scheduled) {
      expect(s.runAt).toBe(100);
    }
  });

  it("narrows correctly by kind for Interval", () => {
    const s: ScheduleDescriptor = { kind: ScheduleKind.Interval, intervalMs: 10, startAt: 0 };
    if (s.kind === ScheduleKind.Interval) {
      expect(s.intervalMs).toBe(10);
    }
  });

  it("narrows correctly by kind for Cron", () => {
    const s: ScheduleDescriptor = { kind: ScheduleKind.Cron, expression: "* * * * *" };
    if (s.kind === ScheduleKind.Cron) {
      expect(s.expression).toBe("* * * * *");
    }
  });
});

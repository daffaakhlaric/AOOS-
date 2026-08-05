import { describe, expect, it } from "vitest";

import { SourceScheduleException } from "../../src/errors/source-schedule-exception.js";
import { KnowledgeSourceScheduleMode } from "../../src/scheduler/knowledge-source-schedule-mode.js";
import { KnowledgeSourceScheduler } from "../../src/scheduler/knowledge-source-scheduler.js";

describe("KnowledgeSourceScheduleMode", () => {
  it("has exactly the 5 modes named in the prompt", () => {
    expect(Object.values(KnowledgeSourceScheduleMode)).toEqual([
      "manual",
      "cron",
      "interval",
      "one_time",
      "future_event",
    ]);
  });
});

describe("KnowledgeSourceScheduler", () => {
  const scheduler = new KnowledgeSourceScheduler();

  it("validates Manual mode with no extra fields", () => {
    expect(scheduler.validate({ mode: KnowledgeSourceScheduleMode.MANUAL })).toBe(true);
  });

  it("requires cronExpression for Cron mode", () => {
    expect(scheduler.validate({ mode: KnowledgeSourceScheduleMode.CRON })).toBe(false);
    expect(
      scheduler.validate({ mode: KnowledgeSourceScheduleMode.CRON, cronExpression: "* * * * *" }),
    ).toBe(true);
  });

  it("requires intervalMs for Interval mode", () => {
    expect(scheduler.validate({ mode: KnowledgeSourceScheduleMode.INTERVAL })).toBe(false);
    expect(
      scheduler.validate({ mode: KnowledgeSourceScheduleMode.INTERVAL, intervalMs: 60_000 }),
    ).toBe(true);
  });

  it("requires runAt for One Time mode", () => {
    expect(scheduler.validate({ mode: KnowledgeSourceScheduleMode.ONE_TIME })).toBe(false);
    expect(
      scheduler.validate({
        mode: KnowledgeSourceScheduleMode.ONE_TIME,
        runAt: new Date().toISOString(),
      }),
    ).toBe(true);
  });

  it("requires eventName for Future Event mode", () => {
    expect(scheduler.validate({ mode: KnowledgeSourceScheduleMode.FUTURE_EVENT })).toBe(false);
    expect(
      scheduler.validate({
        mode: KnowledgeSourceScheduleMode.FUTURE_EVENT,
        eventName: "billing.cycle.closed",
      }),
    ).toBe(true);
  });

  it("assertValid throws SourceScheduleException for an incomplete descriptor", () => {
    expect(() => scheduler.assertValid({ mode: KnowledgeSourceScheduleMode.CRON })).toThrow(
      SourceScheduleException,
    );
  });

  it("describe renders a human-readable summary per mode", () => {
    expect(
      scheduler.describe({ mode: KnowledgeSourceScheduleMode.CRON, cronExpression: "0 0 * * *" }),
    ).toContain("Cron");
    expect(
      scheduler.describe({ mode: KnowledgeSourceScheduleMode.INTERVAL, intervalMs: 1000 }),
    ).toContain("Interval");
    expect(
      scheduler.describe({
        mode: KnowledgeSourceScheduleMode.ONE_TIME,
        runAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toContain("OneTime");
    expect(
      scheduler.describe({ mode: KnowledgeSourceScheduleMode.FUTURE_EVENT, eventName: "evt" }),
    ).toContain("FutureEvent");
    expect(scheduler.describe({ mode: KnowledgeSourceScheduleMode.MANUAL })).toBe("Manual");
  });

  it("describe throws for an invalid descriptor", () => {
    expect(() => scheduler.describe({ mode: KnowledgeSourceScheduleMode.INTERVAL })).toThrow(
      SourceScheduleException,
    );
  });
});

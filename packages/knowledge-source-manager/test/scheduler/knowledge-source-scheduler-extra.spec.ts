import { describe, expect, it } from "vitest";

import { KnowledgeSourceScheduleMode } from "../../src/scheduler/knowledge-source-schedule-mode.js";
import { KnowledgeSourceScheduler } from "../../src/scheduler/knowledge-source-scheduler.js";

describe("KnowledgeSourceScheduler additional coverage", () => {
  const scheduler = new KnowledgeSourceScheduler();

  it("never touches a real timer/cron API (metadata-only class surface)", () => {
    const descriptor = { mode: KnowledgeSourceScheduleMode.CRON, cronExpression: "*/5 * * * *" };
    expect(() => scheduler.assertValid(descriptor)).not.toThrow();
    // Structural guarantee: the class exposes only validate/describe/assertValid.
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(scheduler)).sort()).toEqual(
      ["assertValid", "constructor", "describe", "validate"].sort(),
    );
  });

  it("validate() returns false rather than throwing for every incomplete mode", () => {
    expect(scheduler.validate({ mode: KnowledgeSourceScheduleMode.CRON })).toBe(false);
    expect(scheduler.validate({ mode: KnowledgeSourceScheduleMode.INTERVAL })).toBe(false);
    expect(scheduler.validate({ mode: KnowledgeSourceScheduleMode.ONE_TIME })).toBe(false);
    expect(scheduler.validate({ mode: KnowledgeSourceScheduleMode.FUTURE_EVENT })).toBe(false);
  });
});

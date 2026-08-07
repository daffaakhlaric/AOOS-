import { beforeEach, describe, expect, it } from "vitest";

import { DependencyCycleException } from "../../src/errors/dependency-cycle-exception.js";
import { KnowledgeUpdateScheduler } from "../../src/scheduler/knowledge-update-scheduler.js";
import { ScheduleKind } from "../../src/types/schedule-descriptor.js";
import { resetFixtureState } from "../helpers/fixtures.js";

describe("Scheduler priority + dependency integration", () => {
  beforeEach(resetFixtureState);

  it("orders a 20-job batch of independent jobs strictly by descending priority", () => {
    const scheduler = new KnowledgeUpdateScheduler();
    const priorities = Array.from({ length: 20 }, (_, i) => (i * 37) % 97);
    priorities.forEach((priority, i) => {
      scheduler.register(`job-${i}`, { kind: ScheduleKind.Immediate }, priority, [], 0);
    });
    const due = scheduler.processDue(0);
    const dueWithPriority = due.map((id) => priorities[Number(id.split("-")[1])]!);
    const sorted = [...dueWithPriority].sort((a, b) => b - a);
    expect(dueWithPriority).toEqual(sorted);
  });

  it("respects a diamond dependency graph combined with priority ordering", () => {
    // a -> b, a -> c, b -> d, c -> d. d has the highest priority but must still come last.
    const scheduler = new KnowledgeUpdateScheduler();
    scheduler.register("a", { kind: ScheduleKind.Immediate }, 1, [], 0);
    scheduler.register("b", { kind: ScheduleKind.Immediate }, 5, ["a"], 0);
    scheduler.register("c", { kind: ScheduleKind.Immediate }, 3, ["a"], 0);
    scheduler.register("d", { kind: ScheduleKind.Immediate }, 100, ["b", "c"], 0);

    const order = scheduler.processDue(0);
    expect(order[0]).toBe("a");
    expect(order[order.length - 1]).toBe("d");
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("d"));
    expect(order.indexOf("c")).toBeLessThan(order.indexOf("d"));
  });

  it("processes a long dependency chain (10 jobs) in strict order regardless of registration order", () => {
    const scheduler = new KnowledgeUpdateScheduler();
    const ids = Array.from({ length: 10 }, (_, i) => `n${i}`);
    // Register in reverse order to prove ordering comes from dependencies, not registration.
    for (let i = ids.length - 1; i >= 0; i--) {
      const dependsOn = i === 0 ? [] : [ids[i - 1]!];
      scheduler.register(ids[i]!, { kind: ScheduleKind.Immediate }, 0, dependsOn, 0);
    }
    expect(scheduler.processDue(0)).toEqual(ids);
  });

  it("throws DependencyCycleException for a 3-node cycle discovered at processDue time", () => {
    const scheduler = new KnowledgeUpdateScheduler();
    scheduler.register("a", { kind: ScheduleKind.Immediate }, 0, ["c"], 0);
    scheduler.register("b", { kind: ScheduleKind.Immediate }, 0, ["a"], 0);
    scheduler.register("c", { kind: ScheduleKind.Immediate }, 0, ["b"], 0);
    expect(() => scheduler.processDue(0)).toThrow(DependencyCycleException);
  });

  it("mixes interval, cron, scheduled, and immediate jobs correctly across several ticks", () => {
    const scheduler = new KnowledgeUpdateScheduler();
    const dayStart = Date.UTC(2026, 0, 1, 0, 0);
    scheduler.register("immediate", { kind: ScheduleKind.Immediate }, 0, [], dayStart);
    scheduler.register(
      "interval",
      { kind: ScheduleKind.Interval, intervalMs: 3_600_000, startAt: dayStart },
      0,
      [],
      dayStart,
    );
    scheduler.register(
      "scheduled",
      { kind: ScheduleKind.Scheduled, runAt: dayStart + 7_200_000 },
      0,
      [],
      dayStart,
    );
    scheduler.register(
      "cron",
      { kind: ScheduleKind.Cron, expression: "0 6 * * *" },
      0,
      [],
      dayStart,
    );

    // t=0: immediate + interval (both due at dayStart)
    let due = scheduler.processDue(dayStart);
    expect(due.sort()).toEqual(["immediate", "interval"]);

    // t=+1h: interval fires again
    due = scheduler.processDue(dayStart + 3_600_000);
    expect(due).toEqual(["interval"]);

    // t=+2h: interval + scheduled
    due = scheduler.processDue(dayStart + 7_200_000);
    expect(due.sort()).toEqual(["interval", "scheduled"]);
    expect(scheduler.isScheduled("scheduled")).toBe(false); // one-shot, now removed

    // t=+6h: interval + cron (06:00)
    due = scheduler.processDue(dayStart + 6 * 3_600_000);
    expect(due.sort()).toEqual(["cron", "interval"]);
  });

  it("supports cancelling a job mid-batch without affecting others", () => {
    const scheduler = new KnowledgeUpdateScheduler();
    scheduler.register("a", { kind: ScheduleKind.Immediate }, 0, [], 0);
    scheduler.register("b", { kind: ScheduleKind.Immediate }, 0, [], 0);
    scheduler.cancel("a");
    expect(scheduler.processDue(0)).toEqual(["b"]);
  });

  it("supports pausing one job in a dependency chain without blocking unrelated jobs", () => {
    const scheduler = new KnowledgeUpdateScheduler();
    scheduler.register("independent", { kind: ScheduleKind.Immediate }, 0, [], 0);
    scheduler.register("chain-a", { kind: ScheduleKind.Immediate }, 0, [], 0);
    scheduler.register("chain-b", { kind: ScheduleKind.Immediate }, 0, ["chain-a"], 0);
    scheduler.pause("chain-a");
    const due = scheduler.processDue(0);
    expect(due).toContain("independent");
    expect(due).not.toContain("chain-a");
    // chain-b's dependency isn't in the due set (chain-a is paused), so it runs unordered
    // relative to chain-a, but must still appear since it has no *due* blocking dependency edge.
    expect(due).toContain("chain-b");
  });
});

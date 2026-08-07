import { describe, expect, it } from "vitest";

import { DependencyCycleException } from "../../src/errors/dependency-cycle-exception.js";
import { InvalidScheduleException } from "../../src/errors/invalid-schedule-exception.js";
import { JobNotFoundException } from "../../src/errors/job-not-found-exception.js";
import {
  KnowledgeUpdateScheduler,
  computeInitialRunAt,
  computeNextRunAt,
} from "../../src/scheduler/knowledge-update-scheduler.js";
import { ScheduleKind } from "../../src/types/schedule-descriptor.js";

describe("computeInitialRunAt", () => {
  it("returns now for an Immediate schedule", () => {
    expect(computeInitialRunAt({ kind: ScheduleKind.Immediate }, 500)).toBe(500);
  });

  it("returns runAt for a Scheduled schedule", () => {
    expect(computeInitialRunAt({ kind: ScheduleKind.Scheduled, runAt: 1000 }, 0)).toBe(1000);
  });

  it("returns startAt for an Interval schedule when startAt is in the future", () => {
    expect(
      computeInitialRunAt({ kind: ScheduleKind.Interval, intervalMs: 100, startAt: 2000 }, 500),
    ).toBe(2000);
  });

  it("returns now for an Interval schedule when startAt is in the past", () => {
    expect(
      computeInitialRunAt({ kind: ScheduleKind.Interval, intervalMs: 100, startAt: 0 }, 500),
    ).toBe(500);
  });

  it("returns the next matching cron fire time at-or-after now", () => {
    const now = Date.UTC(2026, 0, 1, 9, 30);
    expect(computeInitialRunAt({ kind: ScheduleKind.Cron, expression: "30 9 * * *" }, now)).toBe(
      now,
    );
  });
});

describe("computeNextRunAt", () => {
  it("returns undefined for Immediate (one-shot)", () => {
    expect(computeNextRunAt({ kind: ScheduleKind.Immediate }, 0)).toBeUndefined();
  });

  it("returns undefined for Scheduled (one-shot)", () => {
    expect(computeNextRunAt({ kind: ScheduleKind.Scheduled, runAt: 0 }, 0)).toBeUndefined();
  });

  it("returns firedAt + intervalMs for Interval", () => {
    expect(
      computeNextRunAt({ kind: ScheduleKind.Interval, intervalMs: 1000, startAt: 0 }, 5000),
    ).toBe(6000);
  });

  it("returns the next cron fire time after firedAt for Cron", () => {
    const firedAt = Date.UTC(2026, 0, 1, 9, 30);
    const next = computeNextRunAt({ kind: ScheduleKind.Cron, expression: "30 9 * * *" }, firedAt);
    expect(next).toBe(Date.UTC(2026, 0, 2, 9, 30));
  });
});

describe("KnowledgeUpdateScheduler", () => {
  describe("register", () => {
    it("registers an immediate job as due right away", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      scheduler.register("j1", { kind: ScheduleKind.Immediate }, 0, [], 100);
      expect(scheduler.getNextRunAt("j1")).toBe(100);
      expect(scheduler.size).toBe(1);
    });

    it("registers a scheduled job at its runAt", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      scheduler.register("j1", { kind: ScheduleKind.Scheduled, runAt: 5000 }, 0, [], 0);
      expect(scheduler.getNextRunAt("j1")).toBe(5000);
    });

    it("throws InvalidScheduleException for a non-positive interval", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      expect(() =>
        scheduler.register(
          "j1",
          { kind: ScheduleKind.Interval, intervalMs: 0, startAt: 0 },
          0,
          [],
          0,
        ),
      ).toThrow(InvalidScheduleException);
    });

    it("re-registering the same jobId replaces its entry (not duplicated)", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      scheduler.register("j1", { kind: ScheduleKind.Immediate }, 0, [], 0);
      scheduler.register("j1", { kind: ScheduleKind.Scheduled, runAt: 999 }, 0, [], 0);
      expect(scheduler.size).toBe(1);
      expect(scheduler.getNextRunAt("j1")).toBe(999);
    });
  });

  describe("pause/resume/cancel", () => {
    it("pause prevents a job from being returned as due", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      scheduler.register("j1", { kind: ScheduleKind.Immediate }, 0, [], 0);
      scheduler.pause("j1");
      expect(scheduler.isPaused("j1")).toBe(true);
      expect(scheduler.processDue(1000)).toEqual([]);
    });

    it("resume makes a paused job due again", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      scheduler.register("j1", { kind: ScheduleKind.Immediate }, 0, [], 0);
      scheduler.pause("j1");
      scheduler.resume("j1");
      expect(scheduler.isPaused("j1")).toBe(false);
      expect(scheduler.processDue(0)).toEqual(["j1"]);
    });

    it("cancel removes the job from the scheduler", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      scheduler.register("j1", { kind: ScheduleKind.Immediate }, 0, [], 0);
      scheduler.cancel("j1");
      expect(scheduler.isScheduled("j1")).toBe(false);
      expect(scheduler.size).toBe(0);
    });

    it("cancel throws JobNotFoundException for an unregistered job", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      expect(() => scheduler.cancel("missing")).toThrow(JobNotFoundException);
    });

    it("pause/resume/getNextRunAt throw JobNotFoundException for unregistered jobs", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      expect(() => scheduler.pause("missing")).toThrow(JobNotFoundException);
      expect(() => scheduler.resume("missing")).toThrow(JobNotFoundException);
      expect(() => scheduler.getNextRunAt("missing")).toThrow(JobNotFoundException);
      expect(() => scheduler.isPaused("missing")).toThrow(JobNotFoundException);
      expect(() => scheduler.updatePriority("missing", 1)).toThrow(JobNotFoundException);
      expect(() => scheduler.reschedule("missing", 0)).toThrow(JobNotFoundException);
    });
  });

  describe("processDue — Immediate/Scheduled one-shot removal", () => {
    it("removes an immediate job from the queue once processed", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      scheduler.register("j1", { kind: ScheduleKind.Immediate }, 0, [], 0);
      expect(scheduler.processDue(0)).toEqual(["j1"]);
      expect(scheduler.isScheduled("j1")).toBe(false);
      expect(scheduler.processDue(1000)).toEqual([]);
    });

    it("does not return a scheduled job before its runAt", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      scheduler.register("j1", { kind: ScheduleKind.Scheduled, runAt: 1000 }, 0, [], 0);
      expect(scheduler.processDue(500)).toEqual([]);
      expect(scheduler.processDue(1000)).toEqual(["j1"]);
    });
  });

  describe("processDue — Interval re-scheduling", () => {
    it("reschedules an interval job to fire again after intervalMs", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      scheduler.register(
        "j1",
        { kind: ScheduleKind.Interval, intervalMs: 1000, startAt: 0 },
        0,
        [],
        0,
      );
      expect(scheduler.processDue(0)).toEqual(["j1"]);
      expect(scheduler.getNextRunAt("j1")).toBe(1000);
      expect(scheduler.processDue(999)).toEqual([]);
      expect(scheduler.processDue(1000)).toEqual(["j1"]);
      expect(scheduler.getNextRunAt("j1")).toBe(2000);
    });
  });

  describe("processDue — Cron re-scheduling", () => {
    it("fires at the cron time and reschedules to the next occurrence", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      const first = Date.UTC(2026, 0, 1, 9, 30);
      scheduler.register("j1", { kind: ScheduleKind.Cron, expression: "30 9 * * *" }, 0, [], first);
      expect(scheduler.processDue(first)).toEqual(["j1"]);
      expect(scheduler.getNextRunAt("j1")).toBe(Date.UTC(2026, 0, 2, 9, 30));
    });
  });

  describe("processDue — priority ordering", () => {
    it("orders due jobs by descending priority", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      scheduler.register("low", { kind: ScheduleKind.Immediate }, 1, [], 0);
      scheduler.register("high", { kind: ScheduleKind.Immediate }, 10, [], 0);
      scheduler.register("mid", { kind: ScheduleKind.Immediate }, 5, [], 0);
      expect(scheduler.processDue(0)).toEqual(["high", "mid", "low"]);
    });

    it("breaks priority ties FIFO by registration order", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      scheduler.register("first", { kind: ScheduleKind.Immediate }, 5, [], 0);
      scheduler.register("second", { kind: ScheduleKind.Immediate }, 5, [], 0);
      scheduler.register("third", { kind: ScheduleKind.Immediate }, 5, [], 0);
      expect(scheduler.processDue(0)).toEqual(["first", "second", "third"]);
    });

    it("updatePriority changes future ordering", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      scheduler.register(
        "a",
        { kind: ScheduleKind.Interval, intervalMs: 100, startAt: 0 },
        1,
        [],
        0,
      );
      scheduler.register(
        "b",
        { kind: ScheduleKind.Interval, intervalMs: 100, startAt: 0 },
        2,
        [],
        0,
      );
      expect(scheduler.processDue(0)).toEqual(["b", "a"]);
      scheduler.updatePriority("a", 100);
      expect(scheduler.processDue(100)).toEqual(["a", "b"]);
    });
  });

  describe("processDue — dependency-aware ordering", () => {
    it("orders a dependent job after its dependency even with lower priority", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      scheduler.register("dependency", { kind: ScheduleKind.Immediate }, 1, [], 0);
      scheduler.register("dependent", { kind: ScheduleKind.Immediate }, 100, ["dependency"], 0);
      expect(scheduler.processDue(0)).toEqual(["dependency", "dependent"]);
    });

    it("ignores dependencies not part of the due batch", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      scheduler.register("solo", { kind: ScheduleKind.Immediate }, 0, ["not-scheduled"], 0);
      expect(scheduler.processDue(0)).toEqual(["solo"]);
    });

    it("throws DependencyCycleException for a cyclic due batch", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      scheduler.register("a", { kind: ScheduleKind.Immediate }, 0, ["b"], 0);
      scheduler.register("b", { kind: ScheduleKind.Immediate }, 0, ["a"], 0);
      expect(() => scheduler.processDue(0)).toThrow(DependencyCycleException);
    });
  });

  describe("processDue — empty/no-op cases", () => {
    it("returns an empty array when nothing is due", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      expect(scheduler.processDue(0)).toEqual([]);
    });

    it("returns an empty array with no registered jobs at all", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      expect(scheduler.processDue(999_999)).toEqual([]);
    });
  });

  describe("additional edge cases", () => {
    it("size reflects the number of currently-registered jobs", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      expect(scheduler.size).toBe(0);
      scheduler.register("a", { kind: ScheduleKind.Immediate }, 0, [], 0);
      scheduler.register("b", { kind: ScheduleKind.Immediate }, 0, [], 0);
      expect(scheduler.size).toBe(2);
      scheduler.cancel("a");
      expect(scheduler.size).toBe(1);
    });

    it("isScheduled returns false for a never-registered job", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      expect(scheduler.isScheduled("nope")).toBe(false);
    });

    it("pausing an already-paused job is idempotent", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      scheduler.register("a", { kind: ScheduleKind.Immediate }, 0, [], 0);
      scheduler.pause("a");
      scheduler.pause("a");
      expect(scheduler.isPaused("a")).toBe(true);
    });

    it("resuming a never-paused job is a no-op", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      scheduler.register("a", { kind: ScheduleKind.Immediate }, 0, [], 0);
      scheduler.resume("a");
      expect(scheduler.isPaused("a")).toBe(false);
    });

    it("re-registering after cancel works normally", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      scheduler.register("a", { kind: ScheduleKind.Immediate }, 0, [], 0);
      scheduler.cancel("a");
      scheduler.register("a", { kind: ScheduleKind.Immediate }, 0, [], 0);
      expect(scheduler.isScheduled("a")).toBe(true);
    });

    it("a Scheduled job far in the future never appears due", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      scheduler.register("a", { kind: ScheduleKind.Scheduled, runAt: 1_000_000 }, 0, [], 0);
      expect(scheduler.processDue(999_999)).toEqual([]);
    });

    it("multiple interval jobs with different periods interleave correctly", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      scheduler.register(
        "fast",
        { kind: ScheduleKind.Interval, intervalMs: 100, startAt: 0 },
        0,
        [],
        0,
      );
      scheduler.register(
        "slow",
        { kind: ScheduleKind.Interval, intervalMs: 300, startAt: 0 },
        0,
        [],
        0,
      );
      expect(scheduler.processDue(0).sort()).toEqual(["fast", "slow"]);
      expect(scheduler.processDue(100)).toEqual(["fast"]);
      expect(scheduler.processDue(200)).toEqual(["fast"]);
      expect(scheduler.processDue(300).sort()).toEqual(["fast", "slow"]);
    });
  });

  describe("reschedule", () => {
    it("updates a job's nextRunAt directly (used for retry/backoff scheduling)", () => {
      const scheduler = new KnowledgeUpdateScheduler();
      scheduler.register("j1", { kind: ScheduleKind.Immediate }, 0, [], 0);
      scheduler.processDue(0);
      // Simulate retry: job was one-shot and removed; re-register then reschedule.
      scheduler.register("j2", { kind: ScheduleKind.Scheduled, runAt: 1000 }, 0, [], 0);
      scheduler.reschedule("j2", 5000);
      expect(scheduler.getNextRunAt("j2")).toBe(5000);
      expect(scheduler.processDue(1000)).toEqual([]);
      expect(scheduler.processDue(5000)).toEqual(["j2"]);
    });
  });
});

import { describe, expect, it } from "vitest";

import { MockClock } from "../../src/clock/mock-clock.js";
import { JobState } from "../../src/contracts/job-state.js";
import { TriggerType } from "../../src/contracts/trigger-type.js";
import { InMemoryScheduleStore } from "../../src/store-interface/in-memory-schedule-store.js";
import { TimerService } from "../../src/timer/timer-service.js";
import { TimeTrigger } from "../../src/trigger/time-trigger.js";
import { jobFixture } from "../helpers/job-fixture.js";

describe("Trigger Test — TimeTrigger", () => {
  it("reports its type as Time", () => {
    const clock = new MockClock();
    const store = new InMemoryScheduleStore();
    const trigger = new TimeTrigger(new TimerService(clock, store));
    expect(trigger.type).toBe(TriggerType.TIME);
  });

  it("tick() delegates to the underlying Timer", async () => {
    const clock = new MockClock("2026-01-01T00:00:00.000Z");
    const store = new InMemoryScheduleStore();
    await store.create(
      jobFixture({ jobId: "due", state: JobState.WAITING, nextFireAt: "2026-01-01T00:00:00.000Z" }),
    );
    const trigger = new TimeTrigger(new TimerService(clock, store));

    const result = await trigger.tick();
    expect(result.readyJobIds).toEqual(["due"]);
  });
});

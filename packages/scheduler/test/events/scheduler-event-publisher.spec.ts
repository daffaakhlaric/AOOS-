import { EventCategory } from "@aos/event-bus";
import type { BaseEventShape, IPublisher, PublishInput } from "@aos/event-bus";
import { describe, expect, it, vi } from "vitest";

import { JobPriority } from "../../src/contracts/job-priority.js";
import { JobState } from "../../src/contracts/job-state.js";
import { ScheduleType } from "../../src/contracts/schedule-type.js";
import { TriggerType } from "../../src/contracts/trigger-type.js";
import { SchedulerEventPublisher } from "../../src/events/scheduler-event-publisher.js";
import { SchedulerJobEventType } from "../../src/events/scheduler-job-event-type.js";
import { jobFixture } from "../helpers/job-fixture.js";

function fakePublisher(): { publisher: IPublisher; publish: ReturnType<typeof vi.fn> } {
  const publish = vi.fn(async (input: PublishInput): Promise<BaseEventShape> => ({
    eventId: "e-1",
    type: input.type,
    category: input.category,
    correlationId: "corr-1",
    source: input.source,
    producer: input.producer,
    timestamp: "2026-01-01T00:00:00.000Z",
    priority: input.priority as never,
    version: "1.0.0",
    schemaVersion: "1.0.0",
    payload: input.payload,
    tenantId: input.tenantId,
  }));
  return { publisher: { publish, publishAsync: publish, publishBatch: vi.fn() }, publish };
}

describe("Event Publishing Flow — SchedulerEventPublisher", () => {
  it("publishes onto the Event Bus with the correct type/category/payload", async () => {
    const { publisher, publish } = fakePublisher();
    const eventPublisher = new SchedulerEventPublisher(publisher);
    const job = jobFixture({
      state: JobState.WAITING,
      priority: JobPriority.HIGH,
      tenantId: "t-1",
    });

    await eventPublisher.publishJobEvent(SchedulerJobEventType.CREATED, job);

    expect(publish).toHaveBeenCalledTimes(1);
    const input = publish.mock.calls[0]![0] as PublishInput;
    expect(input.type).toBe(SchedulerJobEventType.CREATED);
    expect(input.category).toBe(EventCategory.DOMAIN);
    expect(input.tenantId).toBe("t-1");
    expect(input.producer).toBe("@aos/scheduler");
    expect(input.payload).toMatchObject({
      jobId: job.jobId,
      name: job.name,
      state: JobState.WAITING,
      priority: JobPriority.HIGH,
      scheduleType: ScheduleType.MANUAL,
    });
  });

  it("merges extra payload fields (e.g. an error message)", async () => {
    const { publisher, publish } = fakePublisher();
    const eventPublisher = new SchedulerEventPublisher(publisher);
    const job = jobFixture({ state: JobState.FAILED, triggerType: TriggerType.TIME });

    await eventPublisher.publishJobEvent(SchedulerJobEventType.FAILED, job, { error: "boom" });

    const input = publish.mock.calls[0]![0] as PublishInput;
    expect(input.payload).toMatchObject({ error: "boom" });
  });

  it("uses a custom source when supplied", async () => {
    const { publisher, publish } = fakePublisher();
    const eventPublisher = new SchedulerEventPublisher(publisher, "custom-source");
    await eventPublisher.publishJobEvent(SchedulerJobEventType.CREATED, jobFixture());
    const input = publish.mock.calls[0]![0] as PublishInput;
    expect(input.source).toBe("custom-source");
  });
});

import type { BaseEventShape, IPublisher, PublishInput } from "@aos/event-bus";
import { describe, expect, it, vi } from "vitest";

import { SchedulerSystem } from "../../src/bootstrap/scheduler-system.js";
import { ScheduleType } from "../../src/contracts/schedule-type.js";
import { ValidationException } from "../../src/errors/validation-exception.js";

function fakePublisher(): IPublisher {
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
  return { publish, publishAsync: publish, publishBatch: vi.fn() };
}

describe("SchedulerSystem — IModule lifecycle (Kernel integration point)", () => {
  it("exposes a working Scheduler", async () => {
    const system = new SchedulerSystem(fakePublisher());
    const job = await system.scheduler.createJob({
      name: "j",
      schedule: { type: ScheduleType.MANUAL, timezone: "UTC" },
    });
    expect(job.name).toBe("j");
  });

  it("wires allowedTenantIds from config into the Scheduler's validation", async () => {
    const system = new SchedulerSystem(fakePublisher(), { allowedTenantIds: ["t-1"] });
    await expect(
      system.scheduler.createJob({
        name: "j",
        tenantId: "t-2",
        schedule: { type: ScheduleType.MANUAL, timezone: "UTC" },
      }),
    ).rejects.toThrow(ValidationException);
  });

  it("onBootstrap resolves without throwing", async () => {
    const system = new SchedulerSystem(fakePublisher());
    await expect(system.onBootstrap?.({} as never)).resolves.toBeUndefined();
  });

  it("onShutdown resolves without throwing", async () => {
    const system = new SchedulerSystem(fakePublisher());
    await expect(system.onShutdown?.({} as never)).resolves.toBeUndefined();
  });
});

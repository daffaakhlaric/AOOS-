import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import type { StoredCalendarEvent } from "./domain/calendar-event.js";
import { SchedulerController } from "./scheduler.controller.js";
import type { SchedulerService } from "./scheduler.service.js";

function event(overrides: Partial<StoredCalendarEvent> = {}): StoredCalendarEvent {
  return {
    id: "evt-1",
    tenantId: "dss-motor",
    eventType: "SCRAPER_RUN",
    title: "Scrape Foto Mobix",
    scheduledAt: "2026-08-19T06:00:00.000Z",
    timezone: "Asia/Jakarta",
    recurrence: "ONCE",
    status: "PENDING",
    createdBy: "system",
    createdAt: "2026-08-18T00:00:00.000Z",
    ...overrides,
  };
}

function buildFakeService(overrides: Partial<Record<string, unknown>> = {}): SchedulerService {
  return {
    listEvents: vi.fn(async () => [event()]),
    createEvent: vi.fn(async () => event()),
    updateEvent: vi.fn(async () => event({ title: "Updated" })),
    removeEvent: vi.fn(async () => undefined),
    runNow: vi.fn(async () => event({ status: "DONE" })),
    skip: vi.fn(async () => event({ status: "SKIPPED" })),
    ...overrides,
  } as unknown as SchedulerService;
}

describe("SchedulerController — delegation", () => {
  it("GET / delegates to listEvents and maps to response DTOs", async () => {
    const service = buildFakeService();
    const result = await new SchedulerController(service).list({ range: "this_week" });
    expect(service.listEvents).toHaveBeenCalledWith({ range: "this_week" });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("evt-1");
  });

  it("POST / delegates to createEvent", async () => {
    const service = buildFakeService();
    const body = {
      eventType: "SCRAPER_RUN" as const,
      title: "Scrape",
      scheduledAt: "2026-08-19T06:00:00+07:00",
      recurrence: "ONCE" as const,
    };
    await new SchedulerController(service).create(body);
    expect(service.createEvent).toHaveBeenCalledWith(body);
  });

  it("PUT /:id delegates to updateEvent", async () => {
    const service = buildFakeService();
    const result = await new SchedulerController(service).update("evt-1", { title: "Updated" });
    expect(service.updateEvent).toHaveBeenCalledWith("evt-1", { title: "Updated" });
    expect(result.title).toBe("Updated");
  });

  it("DELETE /:id delegates to removeEvent", async () => {
    const service = buildFakeService();
    await new SchedulerController(service).remove("evt-1");
    expect(service.removeEvent).toHaveBeenCalledWith("evt-1");
  });

  it("POST /:id/run-now delegates to runNow", async () => {
    const service = buildFakeService();
    const result = await new SchedulerController(service).runNow("evt-1");
    expect(service.runNow).toHaveBeenCalledWith("evt-1");
    expect(result.status).toBe("DONE");
  });

  it("POST /:id/skip delegates to skip", async () => {
    const service = buildFakeService();
    const result = await new SchedulerController(service).skip("evt-1");
    expect(service.skip).toHaveBeenCalledWith("evt-1");
    expect(result.status).toBe("SKIPPED");
  });
});

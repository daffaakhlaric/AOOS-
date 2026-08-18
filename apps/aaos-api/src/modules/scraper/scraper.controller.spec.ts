import "reflect-metadata";

import { Branch } from "@aos/meta-ads-connector";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ScrapeJobDto } from "./dto/scraper.dto.js";
import { ScraperController, STREAM_POLL_INTERVAL_MS } from "./scraper.controller.js";
import type { ScraperService } from "./scraper.service.js";

function job(overrides: Partial<ScrapeJobDto> = {}): ScrapeJobDto {
  return {
    id: "job-1",
    kind: "FULL",
    status: "RUNNING",
    progressCurrent: 0,
    logs: [],
    createdAt: "2026-08-17T00:00:00.000Z",
    updatedAt: "2026-08-17T00:00:00.000Z",
    ...overrides,
  };
}

function buildFakeService(overrides: Partial<Record<string, unknown>> = {}): ScraperService {
  return {
    getStatus: vi.fn(async () => ({
      totalUnits: 48,
      availableUnits: 45,
      totalPhotos: 312,
      byBranch: {},
    })),
    getStock: vi.fn(async () => ({ units: [], total: 0, page: 1, limit: 50 })),
    getUnit: vi.fn(async () => ({ unitId: "a" })),
    run: vi.fn(async () => ({ jobId: "job-1", status: "RUNNING" as const, kind: "FULL" as const })),
    getJob: vi.fn(async () => job({ status: "DONE" })),
    listJobs: vi.fn(async () => [job()]),
    ...overrides,
  } as unknown as ScraperService;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ScraperController — delegation", () => {
  it("GET status delegates to ScraperService.getStatus", async () => {
    const service = buildFakeService();
    const result = await new ScraperController(service).status();
    expect(service.getStatus).toHaveBeenCalled();
    expect(result.totalUnits).toBe(48);
  });

  it("GET stock passes the validated query straight through", async () => {
    const service = buildFakeService();
    const query = { page: 2, limit: 10, branch: Branch.CINERE, sort: undefined } as never;
    await new ScraperController(service).stock(query);
    expect(service.getStock).toHaveBeenCalledWith(query);
  });

  it("GET stock/:unitId delegates to getUnit", async () => {
    const service = buildFakeService();
    await new ScraperController(service).unit("brio-a");
    expect(service.getUnit).toHaveBeenCalledWith("brio-a");
  });

  it("POST run delegates to run and returns the jobId", async () => {
    const service = buildFakeService();
    const body = { unitUrl: undefined, branch: undefined } as never;
    const result = await new ScraperController(service).run(body);
    expect(service.run).toHaveBeenCalledWith(body);
    expect(result.jobId).toBe("job-1");
  });

  it("GET jobs/:jobId delegates to getJob", async () => {
    const service = buildFakeService();
    await new ScraperController(service).job("job-1");
    expect(service.getJob).toHaveBeenCalledWith("job-1");
  });

  it("GET jobs delegates to listJobs", async () => {
    const service = buildFakeService();
    const result = await new ScraperController(service).jobs();
    expect(service.listJobs).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });
});

describe("ScraperController — @Sse() progress stream", () => {
  it("registers a real Nest SSE route (the first in this codebase) at jobs/:jobId/stream", () => {
    // Nest's `@Sse()` stamps `SSE_METADATA` ('__sse__') on the handler. Without it the route would
    // be a plain GET returning a serialized Observable rather than a `text/event-stream`.
    const descriptor = Object.getOwnPropertyDescriptor(ScraperController.prototype, "stream");
    expect(descriptor).toBeDefined();
    const handler = descriptor?.value as object;
    expect(Reflect.getMetadata("__sse__", handler)).toBe(true);
    expect(Reflect.getMetadata("path", handler)).toBe("jobs/:jobId/stream");
  });

  it("emits the current snapshot immediately, so a late-attaching client is never stuck empty", async () => {
    const service = buildFakeService({ getJob: vi.fn(async () => job({ status: "DONE" })) });
    const events = await collect(new ScraperController(service).stream("job-1"));
    expect(events).toHaveLength(1);
    expect((events[0]?.data as ScrapeJobDto).status).toBe("DONE");
  });

  it("completes as soon as the job is no longer RUNNING, keeping the FINAL state", async () => {
    const service = buildFakeService({ getJob: vi.fn(async () => job({ status: "ERROR" })) });
    const events = await collect(new ScraperController(service).stream("job-1"));
    expect((events.at(-1)?.data as ScrapeJobDto).status).toBe("ERROR");
  });

  it("re-reads persisted state on an interval and emits only on real change", async () => {
    vi.useFakeTimers();
    const snapshots = [
      job({ status: "RUNNING", progressCurrent: 0 }),
      // Identical to the previous snapshot — must NOT produce a duplicate event.
      job({ status: "RUNNING", progressCurrent: 0 }),
      job({ status: "RUNNING", progressCurrent: 3 }),
      job({ status: "DONE", progressCurrent: 5 }),
    ];
    let index = 0;
    const service = buildFakeService({
      getJob: vi.fn(async () => snapshots[Math.min(index++, snapshots.length - 1)]),
    });

    const events: { data: unknown }[] = [];
    let completed = false;
    new ScraperController(service).stream("job-1").subscribe({
      next: (event) => events.push(event as { data: unknown }),
      complete: () => {
        completed = true;
      },
    });

    // Drain the initial snapshot, then three interval ticks.
    await vi.advanceTimersByTimeAsync(0);
    for (let tick = 0; tick < 3; tick += 1) {
      await vi.advanceTimersByTimeAsync(STREAM_POLL_INTERVAL_MS);
    }

    expect(completed).toBe(true);
    const statuses = events.map((e) => (e.data as ScrapeJobDto).progressCurrent);
    // 0 (initial), duplicate 0 suppressed, 3, 5 — three events, not four.
    expect(statuses).toEqual([0, 3, 5]);
  });
});

/** Collects an Observable to completion. */
async function collect(observable: {
  subscribe(o: {
    next: (v: { data: unknown }) => void;
    error: (e: unknown) => void;
    complete: () => void;
  }): unknown;
}): Promise<{ data: unknown }[]> {
  return new Promise((resolve, reject) => {
    const events: { data: unknown }[] = [];
    observable.subscribe({
      next: (value) => events.push(value),
      error: reject,
      complete: () => resolve(events),
    });
  });
}

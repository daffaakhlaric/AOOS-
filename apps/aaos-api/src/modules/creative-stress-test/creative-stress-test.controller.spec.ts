import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { CreativeStressTestController } from "./creative-stress-test.controller.js";
import type { CreativeStressTestService } from "./creative-stress-test.service.js";
import type { StoredStressTestRun } from "./domain/stress-test-run.js";

function buildFakeRun(overrides: Partial<StoredStressTestRun> = {}): StoredStressTestRun {
  return {
    id: "run-1",
    tenantId: "dss-motor",
    name: "Run 1",
    sourceType: "LISTING",
    listingId: "listing-1",
    creativeIds: [],
    mode: "STANDARD",
    primaryGoal: "CREATIVE_QUALITY",
    personaIds: ["PRICE_SENSITIVE"],
    objectionSources: ["LISTING_KNOWLEDGE_BASE"],
    status: "DRAFT",
    result: null,
    createdAt: "2026-09-28T00:00:00.000Z",
    ...overrides,
  };
}

function buildFakeService(
  overrides: Partial<CreativeStressTestService> = {},
): CreativeStressTestService {
  const run = buildFakeRun();
  return {
    listRuns: vi.fn(async () => [run]),
    getRun: vi.fn(async () => run),
    createRun: vi.fn(async () => run),
    execute: vi.fn(async () => ({ ...run, status: "WAITING_FOR_ENGINE" }) as StoredStressTestRun),
    cancel: vi.fn(async () => ({ ...run, status: "CANCELLED" }) as StoredStressTestRun),
    ...overrides,
  } as unknown as CreativeStressTestService;
}

describe("CreativeStressTestController", () => {
  it("GET / lists runs scoped to the real per-request tenant", async () => {
    const service = buildFakeService();
    const controller = new CreativeStressTestController(service);
    const result = await controller.list("tenant-a");
    expect(service.listRuns).toHaveBeenCalledWith("tenant-a");
    expect(result).toHaveLength(1);
  });

  it("GET /:id returns one run scoped to the real per-request tenant", async () => {
    const service = buildFakeService();
    const controller = new CreativeStressTestController(service);
    const result = await controller.byId("run-1", "tenant-a");
    expect(service.getRun).toHaveBeenCalledWith("run-1", "tenant-a");
    expect(result.id).toBe("run-1");
  });

  it("POST / creates a real run via the service, tenant-scoped", async () => {
    const service = buildFakeService();
    const controller = new CreativeStressTestController(service);
    const body = {
      name: "Run 1",
      sourceType: "LISTING" as const,
      listingId: "listing-1",
      creativeIds: [],
      mode: "STANDARD" as const,
      primaryGoal: "CREATIVE_QUALITY" as const,
      personaIds: ["PRICE_SENSITIVE" as const],
      objectionSources: ["LISTING_KNOWLEDGE_BASE" as const],
    };
    const result = await controller.create(body, "tenant-a");
    expect(service.createRun).toHaveBeenCalledWith(body, "tenant-a");
    expect(result.status).toBe("DRAFT");
  });

  it("POST /:id/execute forwards to the service and returns whatever real status it lands on", async () => {
    const service = buildFakeService();
    const controller = new CreativeStressTestController(service);
    const result = await controller.execute("run-1", "tenant-a");
    expect(service.execute).toHaveBeenCalledWith("run-1", "tenant-a");
    expect(result.status).toBe("WAITING_FOR_ENGINE");
  });

  it("GET /persona-presets returns the 5 real, versioned static presets", () => {
    const controller = new CreativeStressTestController(buildFakeService());
    const result = controller.personaPresets();
    expect(result.presets).toHaveLength(5);
    expect(result.version).toBeGreaterThan(0);
  });

  it("GET /objection-sources marks LISTING_KNOWLEDGE_BASE real and the others honest gaps", () => {
    const controller = new CreativeStressTestController(buildFakeService());
    const result = controller.objectionSources();
    const listingKb = result.find((s) => s.key === "LISTING_KNOWLEDGE_BASE");
    const firstMessage = result.find((s) => s.key === "FIRST_MESSAGE_INTELLIGENCE");
    expect(listingKb?.available).toBe(true);
    expect(firstMessage?.available).toBe(false);
  });
});

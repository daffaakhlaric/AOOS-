import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { AbTestingController } from "./abtesting.controller.js";
import type { AbTestingService } from "./abtesting.service.js";
import type { StoredAbTest, StoredAbTestVariant } from "./domain/ab-test.js";

function buildFakeTest(overrides: Partial<StoredAbTest> = {}): StoredAbTest {
  return {
    id: "test-1",
    tenantId: "dss-motor",
    name: "ABT-001",
    campaignId: "camp-1",
    adSetId: "adset-1",
    pageId: "page-1",
    waLink: "https://wa.me/6281234567890",
    mode: "AUTO",
    status: "DRAFT",
    thresholdSpend: 100_000,
    thresholdDays: 3,
    minMarginPct: 20,
    autoPauseLoser: true,
    autoScaleWinner: true,
    createdAt: "2026-08-19T06:00:00.000Z",
    ...overrides,
  };
}

function buildFakeService(overrides: Partial<AbTestingService> = {}): AbTestingService {
  const test = buildFakeTest();
  const variants: readonly StoredAbTestVariant[] = [];
  return {
    listTests: vi.fn(async () => [test]),
    getTest: vi.fn(async () => ({ test, variants })),
    createTest: vi.fn(async () => test),
    pauseTest: vi.fn(async () => ({ ...test, status: "PAUSED" }) as StoredAbTest),
    ...overrides,
  } as unknown as AbTestingService;
}

describe("AbTestingController", () => {
  it("GET / lists tests with their variants", async () => {
    const service = buildFakeService();
    const controller = new AbTestingController(service);
    const result = await controller.list({});
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("ABT-001");
  });

  it("GET /:id returns one test with its variants", async () => {
    const service = buildFakeService();
    const controller = new AbTestingController(service);
    const result = await controller.byId("test-1");
    expect(result.id).toBe("test-1");
  });

  it("POST / creates a test and returns it with variants", async () => {
    const service = buildFakeService();
    const controller = new AbTestingController(service);
    const result = await controller.create({
      name: "ABT-001",
      campaignId: "camp-1",
      adSetId: "adset-1",
      pageId: "page-1",
      waLink: "https://wa.me/6281234567890",
      mode: "AUTO",
      variantCount: 2,
      unit: "unit-1",
      branch: "CINERE" as never,
      targetPersona: "PRIMARY_FAMILY" as never,
      primaryMessage: "DP ringan",
      format: "VIDEO_AND_IMAGES",
      urgency: "MEDIUM",
      thresholdSpend: 100_000,
      thresholdDays: 3,
      minMarginPct: 20,
      autoPauseLoser: true,
      autoScaleWinner: true,
    });
    expect(service.createTest).toHaveBeenCalled();
    expect(result.status).toBe("DRAFT");
  });

  it("POST /:id/pause pauses a test", async () => {
    const service = buildFakeService();
    const controller = new AbTestingController(service);
    const result = await controller.pause("test-1");
    expect(service.pauseTest).toHaveBeenCalledWith("test-1");
    expect(result.status).toBe("PAUSED");
  });
});

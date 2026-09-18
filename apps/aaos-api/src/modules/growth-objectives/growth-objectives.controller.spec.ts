import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import type { GrowthObjectiveResponseDto, PacingResponseDto } from "./dto/growth-objective.dto.js";
import { GrowthObjectivesController } from "./growth-objectives.controller.js";
import type { GrowthObjectivesService } from "./growth-objectives.service.js";

const TENANT = "propertyklik-demo";

const OBJECTIVE_SAMPLE: GrowthObjectiveResponseDto = {
  id: "obj-1",
  tenantId: TENANT,
  metric: "HOT_LEADS",
  targetValue: 50,
  startDate: "2026-01-01",
  endDate: "2026-01-31",
  budgetMode: "BALANCED",
  focusListingIds: [],
  areaStrategy: "SAMANTHA",
  manualAreas: [],
  automationMode: "ADVISOR",
  status: "DRAFT",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const PACING_SAMPLE: PacingResponseDto = {
  objectiveId: "obj-1",
  pacing: {
    status: "ON_PACE",
    expectedSpendToDateIdr: 1_000_000,
    actualSpendIdr: 950_000,
    pacingPct: 0.95,
    daysRemaining: 10,
    daysElapsed: 5,
    requiredDailyPaceIdr: 100_000,
    projectedEndOfPeriodSpendIdr: 2_090_000,
  },
  spendSource: "ACCOUNT_WIDE",
};

function buildFakeService(): GrowthObjectivesService {
  return {
    list: vi.fn(async () => ({ objectives: [OBJECTIVE_SAMPLE] })),
    create: vi.fn(async () => OBJECTIVE_SAMPLE),
    getById: vi.fn(async () => OBJECTIVE_SAMPLE),
    activate: vi.fn(async () => ({ ...OBJECTIVE_SAMPLE, status: "ACTIVE" })),
    analyze: vi.fn(async () => ({ ...OBJECTIVE_SAMPLE, status: "PLANNED" })),
    pacing: vi.fn(async () => PACING_SAMPLE),
    checkProgress: vi.fn(async () => ({ ...OBJECTIVE_SAMPLE, status: "ON_TRACK" })),
  } as unknown as GrowthObjectivesService;
}

describe("GrowthObjectivesController", () => {
  it("list() delegates to the service with the tenant id", async () => {
    const service = buildFakeService();
    const controller = new GrowthObjectivesController(service);
    const result = await controller.list(TENANT);
    expect(service.list).toHaveBeenCalledWith(TENANT);
    expect(result.objectives).toHaveLength(1);
  });

  it("create() delegates to the service with the tenant id + validated body", async () => {
    const service = buildFakeService();
    const controller = new GrowthObjectivesController(service);
    const body = {
      metric: "HOT_LEADS" as const,
      targetValue: 50,
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      budgetMode: "BALANCED" as const,
      areaStrategy: "SAMANTHA" as const,
      automationMode: "ADVISOR" as const,
    };
    const result = await controller.create(TENANT, body);
    expect(service.create).toHaveBeenCalledWith(TENANT, body);
    expect(result.id).toBe("obj-1");
  });

  it("byId() delegates to the service", async () => {
    const service = buildFakeService();
    const controller = new GrowthObjectivesController(service);
    const result = await controller.byId(TENANT, "obj-1");
    expect(service.getById).toHaveBeenCalledWith(TENANT, "obj-1");
    expect(result.id).toBe("obj-1");
  });

  it("activate() delegates to the service", async () => {
    const service = buildFakeService();
    const controller = new GrowthObjectivesController(service);
    const result = await controller.activate(TENANT, "obj-1");
    expect(service.activate).toHaveBeenCalledWith(TENANT, "obj-1");
    expect(result.status).toBe("ACTIVE");
  });

  it("analyze() delegates to the service", async () => {
    const service = buildFakeService();
    const controller = new GrowthObjectivesController(service);
    const result = await controller.analyze(TENANT, "obj-1");
    expect(service.analyze).toHaveBeenCalledWith(TENANT, "obj-1");
    expect(result.status).toBe("PLANNED");
  });

  it("pacing() delegates to the service", async () => {
    const service = buildFakeService();
    const controller = new GrowthObjectivesController(service);
    const result = await controller.pacing(TENANT, "obj-1");
    expect(service.pacing).toHaveBeenCalledWith(TENANT, "obj-1");
    expect(result).toEqual(PACING_SAMPLE);
  });

  it("checkProgress() delegates to the service", async () => {
    const service = buildFakeService();
    const controller = new GrowthObjectivesController(service);
    const result = await controller.checkProgress(TENANT, "obj-1");
    expect(service.checkProgress).toHaveBeenCalledWith(TENANT, "obj-1");
    expect(result.status).toBe("ON_TRACK");
  });
});

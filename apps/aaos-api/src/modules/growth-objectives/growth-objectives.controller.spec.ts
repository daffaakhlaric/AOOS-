import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import type { GrowthObjectiveResponseDto } from "./dto/growth-objective.dto.js";
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

function buildFakeService(): GrowthObjectivesService {
  return {
    list: vi.fn(async () => ({ objectives: [OBJECTIVE_SAMPLE] })),
    create: vi.fn(async () => OBJECTIVE_SAMPLE),
    getById: vi.fn(async () => OBJECTIVE_SAMPLE),
    activate: vi.fn(async () => ({ ...OBJECTIVE_SAMPLE, status: "ACTIVE" })),
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
});

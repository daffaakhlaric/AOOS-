import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import type {
  BudgetSuggestionResponseDto,
  PropertyObjectiveResponseDto,
} from "./dto/property-objective.dto.js";
import { PropertyObjectiveController } from "./property-objective.controller.js";
import type { PropertyObjectiveService } from "./property-objective.service.js";

function buildFakeService(): PropertyObjectiveService {
  return {
    get: vi.fn(async () => ({ id: "obj-1", status: "DRAFT" }) as PropertyObjectiveResponseDto),
    create: vi.fn(async () => ({ id: "obj-2", status: "DRAFT" }) as PropertyObjectiveResponseDto),
    getBudgetSuggestion: vi.fn(
      async () =>
        ({
          available: true,
          suggestedBudget: 1_500_000,
          portfolioAvgCplIDR: 150_000,
          targetHotLeads: 10,
        }) as BudgetSuggestionResponseDto,
    ),
  } as unknown as PropertyObjectiveService;
}

describe("PropertyObjectiveController", () => {
  it("GET /api/v1/property-objective delegates to PropertyObjectiveService.get with the real tenant id", async () => {
    const service = buildFakeService();
    const controller = new PropertyObjectiveController(service);
    const result = await controller.get("tenant-1");
    expect(service.get).toHaveBeenCalledWith("tenant-1");
    expect(result).toEqual({ id: "obj-1", status: "DRAFT" });
  });

  it("POST /api/v1/property-objective delegates to PropertyObjectiveService.create with tenant id + body", async () => {
    const service = buildFakeService();
    const controller = new PropertyObjectiveController(service);
    const body = {
      targetHotLeads: 20,
      budgetAllocation: 5_000_000,
      budgetSource: "MANUAL" as const,
      focusListings: ["The Green Residence"],
      areaPriorities: ["Jakarta Selatan"],
    };
    const result = await controller.create("tenant-1", body);
    expect(service.create).toHaveBeenCalledWith("tenant-1", body);
    expect(result).toEqual({ id: "obj-2", status: "DRAFT" });
  });

  it("GET /api/v1/property-objective/budget-suggestion delegates to PropertyObjectiveService.getBudgetSuggestion", async () => {
    const service = buildFakeService();
    const controller = new PropertyObjectiveController(service);
    const result = await controller.getBudgetSuggestion({ targetHotLeads: 10 }, "corr-1");
    expect(service.getBudgetSuggestion).toHaveBeenCalledWith(10, "corr-1");
    expect(result).toEqual({
      available: true,
      suggestedBudget: 1_500_000,
      portfolioAvgCplIDR: 150_000,
      targetHotLeads: 10,
    });
  });

  it("guards the whole controller with ApiKeyGuard", () => {
    const guards = Reflect.getMetadata("__guards__", PropertyObjectiveController) as unknown[];
    expect(guards).toContain(ApiKeyGuard);
  });
});

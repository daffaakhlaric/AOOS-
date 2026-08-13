import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import type { ObjectiveResponseDto } from "./dto/objective-response.dto.js";
import { ObjectiveController } from "./objective.controller.js";
import type { ObjectiveService } from "./objective.service.js";

function buildFakeService(): ObjectiveService {
  return {
    getCurrentObjective: vi.fn(() => ({ id: "obj-1", status: "DRAFT" }) as ObjectiveResponseDto),
    createObjective: vi.fn(async () => ({ id: "obj-2", status: "DRAFT" }) as ObjectiveResponseDto),
  } as unknown as ObjectiveService;
}

describe("ObjectiveController", () => {
  it("GET /api/v1/objective delegates to ObjectiveService.getCurrentObjective", () => {
    const service = buildFakeService();
    const controller = new ObjectiveController(service);
    const result = controller.getCurrentObjective();
    expect(service.getCurrentObjective).toHaveBeenCalled();
    expect(result).toEqual({ id: "obj-1", status: "DRAFT" });
  });

  it("POST /api/v1/objective delegates to ObjectiveService.createObjective with the body + correlation id", async () => {
    const service = buildFakeService();
    const controller = new ObjectiveController(service);
    const body = {
      targetHotLeads: 50,
      budgetAllocation: 30_000_000,
      focusUnits: ["Xpander"],
      areaPriorities: ["BINTARO"],
    };
    const result = await controller.createObjective(body, "corr-1");
    expect(service.createObjective).toHaveBeenCalledWith(body, "corr-1");
    expect(result).toEqual({ id: "obj-2", status: "DRAFT" });
  });

  it("guards the whole controller with ApiKeyGuard", () => {
    const guards = Reflect.getMetadata("__guards__", ObjectiveController) as unknown[];
    expect(guards).toContain(ApiKeyGuard);
  });
});

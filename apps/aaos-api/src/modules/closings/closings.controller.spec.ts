import "reflect-metadata";

import { ClosingType } from "@aos/lead-store";
import { describe, expect, it, vi } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { ClosingsController } from "./closings.controller.js";
import type { ClosingsService } from "./closings.service.js";
import type { ClosingResponseDto } from "./dto/closing-response.dto.js";

function buildFakeService(): ClosingsService {
  return {
    createClosing: vi.fn(
      async () => ({ id: "closing-1", closingType: "SPK" }) as ClosingResponseDto,
    ),
    getClosings: vi.fn(async () => [{ id: "closing-1" }] as ClosingResponseDto[]),
  } as unknown as ClosingsService;
}

describe("ClosingsController", () => {
  it("POST /api/v1/closings delegates to ClosingsService.createClosing with the body + correlation id", async () => {
    const service = buildFakeService();
    const controller = new ClosingsController(service);
    const body = {
      leadId: "lead-1",
      salesHumanId: "sales-1",
      closingType: ClosingType.SPK,
    };
    const result = await controller.createClosing(body, "corr-1");
    expect(service.createClosing).toHaveBeenCalledWith(body, "corr-1");
    expect(result).toEqual({ id: "closing-1", closingType: "SPK" });
  });

  it("GET /api/v1/closings delegates to ClosingsService.getClosings with the query", async () => {
    const service = buildFakeService();
    const controller = new ClosingsController(service);
    const result = await controller.getClosings({ salesHumanId: "sales-1" });
    expect(service.getClosings).toHaveBeenCalledWith({ salesHumanId: "sales-1" });
    expect(result).toEqual([{ id: "closing-1" }]);
  });

  it("guards the whole controller with ApiKeyGuard", () => {
    const guards = Reflect.getMetadata("__guards__", ClosingsController) as unknown[];
    expect(guards).toContain(ApiKeyGuard);
  });
});

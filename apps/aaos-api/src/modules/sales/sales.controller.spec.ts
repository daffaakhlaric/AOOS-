import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import type { SalesStatsResponseDto } from "./dto/sales-stats-response.dto.js";
import { SalesController } from "./sales.controller.js";
import type { SalesService } from "./sales.service.js";

function buildFakeService(): SalesService {
  return {
    getStats: vi.fn(
      async () =>
        ({
          leadsToday: 3,
          testDriveThisMonth: 5,
          spkThisMonth: 2,
          commissionThisMonthIdr: 11_700_000,
          recentClosings: [],
        }) as SalesStatsResponseDto,
    ),
  } as unknown as SalesService;
}

describe("SalesController", () => {
  it("GET /api/v1/sales/stats delegates to SalesService.getStats with the query", async () => {
    const service = buildFakeService();
    const controller = new SalesController(service);
    const result = await controller.getStats({ salesHumanId: "sales-1" });
    expect(service.getStats).toHaveBeenCalledWith({ salesHumanId: "sales-1" });
    expect(result.leadsToday).toBe(3);
    expect(result.commissionThisMonthIdr).toBe(11_700_000);
  });

  it("guards the whole controller with ApiKeyGuard", () => {
    const guards = Reflect.getMetadata("__guards__", SalesController) as unknown[];
    expect(guards).toContain(ApiKeyGuard);
  });
});

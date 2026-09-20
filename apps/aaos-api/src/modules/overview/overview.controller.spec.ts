import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import type { OverviewTimeseriesResponseDto } from "./dto/overview-timeseries.dto.js";
import { OverviewController } from "./overview.controller.js";
import type { OverviewService } from "./overview.service.js";

const TENANT = "dss-motor";
const CORRELATION_ID = "corr-1";

function buildFakeService(): OverviewService {
  return {
    getOverview: vi.fn(async () => ({
      tenantId: TENANT,
      generatedAt: "2026-01-15T00:00:00.000Z",
      agentStatus: [],
      activities: [],
      insight: { available: false, reason: "PROVIDER_ERROR", message: "unavailable" },
      errors: {},
    })),
    getTimeseries: vi.fn(async (): Promise<OverviewTimeseriesResponseDto> => ({
      tenantId: TENANT,
      points: [
        { date: "2026-01-14", totalSpend: 500_000, totalLeads: 3 },
        { date: "2026-01-15", totalSpend: 750_000, totalLeads: 5 },
      ],
    })),
  } as unknown as OverviewService;
}

describe("OverviewController", () => {
  it("getOverview() delegates to the service with tenant id and correlation id", async () => {
    const service = buildFakeService();
    const controller = new OverviewController(service);
    const result = await controller.getOverview(TENANT, CORRELATION_ID);
    expect(service.getOverview).toHaveBeenCalledWith(TENANT, CORRELATION_ID);
    expect(result.tenantId).toBe(TENANT);
  });

  describe("getTimeseries()", () => {
    it("delegates to the service with tenant id and the validated days query", async () => {
      const service = buildFakeService();
      const controller = new OverviewController(service);
      const result = await controller.getTimeseries(TENANT, { days: 30 });
      expect(service.getTimeseries).toHaveBeenCalledWith(TENANT, 30);
      expect(result.tenantId).toBe(TENANT);
      expect(result.points).toHaveLength(2);
    });

    it("returns the real, honest points array as-is — never reshaped/fabricated", async () => {
      const service = buildFakeService();
      const controller = new OverviewController(service);
      const result = await controller.getTimeseries(TENANT, { days: 90 });
      expect(result.points).toEqual([
        { date: "2026-01-14", totalSpend: 500_000, totalLeads: 3 },
        { date: "2026-01-15", totalSpend: 750_000, totalLeads: 5 },
      ]);
    });
  });
});

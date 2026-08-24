import "reflect-metadata";

import { NotFoundError } from "@aos/errors";
import { describe, expect, it, vi } from "vitest";

import type { IntelligenceSignalsResponseDto } from "./dto/intelligence.dto.js";
import type { CompetitorPageRow } from "./infrastructure/competitor-page.repository.js";
import { IntelligenceController } from "./intelligence.controller.js";
import type { IntelligenceService } from "./intelligence.service.js";

const SAMPLE_SIGNALS: IntelligenceSignalsResponseDto = {
  id: "row-1",
  branchId: null,
  seasonal: { isSpecialPeriod: false },
  trends: { available: false },
  competitor: { available: false },
  inventory: { available: false },
  leadProfile: { totalLeads: 0 },
  closing: { totalEvents: 0 },
  campaignStrategy: undefined,
  digestText: "digest",
  generatedAt: "2026-01-01T00:00:00.000Z",
};

function buildFakeCompetitorRow(overrides: Partial<CompetitorPageRow> = {}): CompetitorPageRow {
  return {
    id: "p-1",
    tenant_id: "dss-motor",
    name: "Mobil88",
    page_id: "100063000000001",
    vertical: "AUTOMOTIVE",
    active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function buildFakeService(overrides: Partial<IntelligenceService> = {}): IntelligenceService {
  return {
    getLatest: vi.fn(async () => SAMPLE_SIGNALS),
    refresh: vi.fn(async () => SAMPLE_SIGNALS),
    listCompetitorPages: vi.fn(async () => [buildFakeCompetitorRow()]),
    createCompetitorPage: vi.fn(async () => buildFakeCompetitorRow()),
    deleteCompetitorPage: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as IntelligenceService;
}

describe("IntelligenceController", () => {
  it("GET intelligence/signals returns the latest real signals", async () => {
    const controller = new IntelligenceController(buildFakeService());
    expect(await controller.getSignals()).toEqual(SAMPLE_SIGNALS);
  });

  it("GET intelligence/signals throws NotFoundError when none has ever been generated", async () => {
    const controller = new IntelligenceController(
      buildFakeService({ getLatest: vi.fn(async () => undefined) as never }),
    );
    await expect(controller.getSignals()).rejects.toThrow(NotFoundError);
  });

  it("POST intelligence/refresh delegates to the service and returns the fresh result", async () => {
    const service = buildFakeService();
    const controller = new IntelligenceController(service);
    const result = await controller.refresh();
    expect(result).toEqual(SAMPLE_SIGNALS);
    expect(vi.mocked(service.refresh)).toHaveBeenCalledTimes(1);
  });

  it("GET competitors maps every row to a CompetitorPageResponseDto", async () => {
    const controller = new IntelligenceController(buildFakeService());
    const result = await controller.listCompetitors();
    expect(result).toEqual([
      {
        id: "p-1",
        name: "Mobil88",
        pageId: "100063000000001",
        vertical: "AUTOMOTIVE",
        active: true,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });

  it("POST competitors creates a page and returns the mapped DTO", async () => {
    const service = buildFakeService();
    const controller = new IntelligenceController(service);
    const result = await controller.createCompetitor({
      name: "Mobil88",
      pageId: "100063000000001",
      vertical: "AUTOMOTIVE",
      active: true,
    });
    expect(result.name).toBe("Mobil88");
    expect(vi.mocked(service.createCompetitorPage)).toHaveBeenCalledTimes(1);
  });

  it("DELETE competitors/:id delegates to the service", async () => {
    const service = buildFakeService();
    const controller = new IntelligenceController(service);
    await controller.deleteCompetitor("p-1");
    expect(vi.mocked(service.deleteCompetitorPage)).toHaveBeenCalledWith("p-1");
  });
});

import "reflect-metadata";

import { NotFoundError } from "@aos/errors";
import { describe, expect, it, vi } from "vitest";

import type { MarketSignalsResponseDto } from "./dto/market-signals.dto.js";
import { MarketIntelligenceController } from "./market-intelligence.controller.js";
import type { MarketIntelligenceService } from "./market-intelligence.service.js";

const SAMPLE_SIGNALS: MarketSignalsResponseDto = {
  id: "mkt-1",
  vertical: "PROPERTY",
  searchTrend: { available: false, reasoning: "" } as never,
  competitorAngleTrend: { available: false, reasoning: "" } as never,
  kprRate: { available: false, reasoning: "" } as never,
  seasonality: { available: true, status: "musim sepi", note: "n" },
  digestText: "digest",
  generatedAt: "2026-09-08T07:00:00.000Z",
};

function buildFakeService(
  overrides: Partial<MarketIntelligenceService> = {},
): MarketIntelligenceService {
  return {
    getLatest: vi.fn(async () => SAMPLE_SIGNALS),
    refresh: vi.fn(async () => SAMPLE_SIGNALS),
    ...overrides,
  } as unknown as MarketIntelligenceService;
}

describe("MarketIntelligenceController", () => {
  it("GET market-signals/latest returns the latest real signals", async () => {
    const controller = new MarketIntelligenceController(buildFakeService());
    expect(await controller.getLatest()).toEqual(SAMPLE_SIGNALS);
  });

  it("GET market-signals/latest throws NotFoundError when none has ever been generated", async () => {
    const controller = new MarketIntelligenceController(
      buildFakeService({ getLatest: vi.fn(async () => undefined) as never }),
    );
    await expect(controller.getLatest()).rejects.toThrow(NotFoundError);
  });

  it("POST market-signals/refresh delegates to the service and returns the fresh result", async () => {
    const service = buildFakeService();
    const controller = new MarketIntelligenceController(service);
    const result = await controller.refresh();
    expect(result).toEqual(SAMPLE_SIGNALS);
    expect(vi.mocked(service.refresh)).toHaveBeenCalledTimes(1);
  });
});

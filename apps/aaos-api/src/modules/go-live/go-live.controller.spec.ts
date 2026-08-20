import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { GoLiveController } from "./go-live.controller.js";
import type { GoLiveService } from "./go-live.service.js";

function buildFakeService(): GoLiveService {
  return {
    execute: vi.fn(async () => ({ id: "sim-1", status: "LIVE" })),
    rollback: vi.fn(async () => ({ id: "sim-1", status: "ROLLED_BACK" })),
    pauseLive: vi.fn(async () => ({ id: "sim-1", status: "LIVE" })),
    listLive: vi.fn(async () => [{ id: "sim-1", status: "LIVE" }]),
  } as unknown as GoLiveService;
}

describe("GoLiveController", () => {
  it("GET live delegates to GoLiveService.listLive", async () => {
    const service = buildFakeService();
    const controller = new GoLiveController(service);
    const result = await controller.listLive();
    expect(service.listLive).toHaveBeenCalled();
    expect(result).toEqual([{ id: "sim-1", status: "LIVE" }]);
  });

  it("POST :id/go-live delegates to GoLiveService.execute", async () => {
    const service = buildFakeService();
    const controller = new GoLiveController(service);
    const body = { confirmation: "GO LIVE", dailyBudgetIDR: 50_000, creative: {} } as never;
    const result = await controller.goLive("sim-1", body, "corr-1");
    expect(service.execute).toHaveBeenCalledWith("sim-1", body, "corr-1");
    expect(result).toEqual({ id: "sim-1", status: "LIVE" });
  });

  it("POST :id/pause delegates to GoLiveService.pauseLive", async () => {
    const service = buildFakeService();
    const controller = new GoLiveController(service);
    const result = await controller.pause("sim-1", "corr-1");
    expect(service.pauseLive).toHaveBeenCalledWith("sim-1", "corr-1");
    expect(result).toEqual({ id: "sim-1", status: "LIVE" });
  });

  it("POST :id/rollback delegates to GoLiveService.rollback", async () => {
    const service = buildFakeService();
    const controller = new GoLiveController(service);
    const body = { notes: "operator note" };
    const result = await controller.rollback("sim-1", body, "corr-1");
    expect(service.rollback).toHaveBeenCalledWith("sim-1", body, "corr-1");
    expect(result).toEqual({ id: "sim-1", status: "ROLLED_BACK" });
  });

  it("guards the whole controller with ApiKeyGuard", () => {
    const guards = Reflect.getMetadata("__guards__", GoLiveController) as unknown[];
    expect(guards).toContain(ApiKeyGuard);
  });
});

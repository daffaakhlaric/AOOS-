import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { SimulationController } from "./simulation.controller.js";
import type { SimulationService } from "./simulation.service.js";

function buildFakeService(): SimulationService {
  return {
    start: vi.fn(async () => ({ id: "sim-1", status: "RUNNING" as const })),
    getStatus: vi.fn(async () => ({ id: "sim-1", status: "DONE" })),
    approve: vi.fn(async () => ({ id: "sim-1", decision: "APPROVED" })),
    reject: vi.fn(async () => ({ id: "sim-1", decision: "REJECTED" })),
    history: vi.fn(async () => [{ id: "sim-1", status: "DONE" }]),
  } as unknown as SimulationService;
}

describe("SimulationController", () => {
  it("POST start delegates to SimulationService.start", async () => {
    const service = buildFakeService();
    const controller = new SimulationController(service);
    const body = { personaIds: ["ready_buyer"] } as never;
    const result = await controller.start(body);
    expect(service.start).toHaveBeenCalledWith(body);
    expect(result).toEqual({ id: "sim-1", status: "RUNNING" });
  });

  it("GET :id/status delegates to SimulationService.getStatus", async () => {
    const service = buildFakeService();
    const controller = new SimulationController(service);
    const result = await controller.status("sim-1");
    expect(service.getStatus).toHaveBeenCalledWith("sim-1");
    expect(result).toEqual({ id: "sim-1", status: "DONE" });
  });

  it("POST :id/approve delegates to SimulationService.approve", async () => {
    const service = buildFakeService();
    const controller = new SimulationController(service);
    const body = { decidedBy: "manager-1" };
    const result = await controller.approve("sim-1", body);
    expect(service.approve).toHaveBeenCalledWith("sim-1", body);
    expect(result).toEqual({ id: "sim-1", decision: "APPROVED" });
  });

  it("POST :id/reject delegates to SimulationService.reject", async () => {
    const service = buildFakeService();
    const controller = new SimulationController(service);
    const body = {};
    const result = await controller.reject("sim-1", body);
    expect(service.reject).toHaveBeenCalledWith("sim-1", body);
    expect(result).toEqual({ id: "sim-1", decision: "REJECTED" });
  });

  it("GET history delegates to SimulationService.history", async () => {
    const service = buildFakeService();
    const controller = new SimulationController(service);
    const result = await controller.history();
    expect(service.history).toHaveBeenCalled();
    expect(result).toEqual([{ id: "sim-1", status: "DONE" }]);
  });

  it("guards the whole controller with ApiKeyGuard", () => {
    const guards = Reflect.getMetadata("__guards__", SimulationController) as unknown[];
    expect(guards).toContain(ApiKeyGuard);
  });
});

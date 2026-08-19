import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import type { SalesHumanAccountResponseDto } from "./dto/sales-human-account.dto.js";
import { SalesHumansController } from "./sales-humans.controller.js";
import type { SalesHumansService } from "./sales-humans.service.js";

const SAMPLE: SalesHumanAccountResponseDto = {
  id: "sh-1",
  name: "Ahmad Fauzi",
  email: "ahmad.fauzi@mobix.id",
  phone: "+62812000001",
  branchId: "BINTARO",
  status: "ON",
  maxLeadsPerDay: 10,
  createdAt: "2026-01-01T00:00:00.000Z",
  lastSignInAt: undefined,
};

function buildFakeService(): SalesHumansService {
  return {
    list: vi.fn(async () => [SAMPLE]),
    create: vi.fn(async () => SAMPLE),
    update: vi.fn(async () => ({ ...SAMPLE, status: "OFF" })),
    resetPassword: vi.fn(async () => SAMPLE),
  } as unknown as SalesHumansService;
}

describe("SalesHumansController", () => {
  it("GET /api/v1/sales-humans delegates to service.list with the branchId query", async () => {
    const service = buildFakeService();
    const controller = new SalesHumansController(service);
    const result = await controller.list({ branchId: "BINTARO" });
    expect(service.list).toHaveBeenCalledWith("BINTARO");
    expect(result).toEqual([SAMPLE]);
  });

  it("POST /api/v1/sales-humans delegates to service.create", async () => {
    const service = buildFakeService();
    const controller = new SalesHumansController(service);
    const body = {
      name: "Ahmad Fauzi",
      email: "ahmad.fauzi@mobix.id",
      password: "password123",
      branchId: "BINTARO",
    };
    const result = await controller.create(body);
    expect(service.create).toHaveBeenCalledWith(body);
    expect(result).toEqual(SAMPLE);
  });

  it("PUT /api/v1/sales-humans/:id delegates to service.update", async () => {
    const service = buildFakeService();
    const controller = new SalesHumansController(service);
    const result = await controller.update("sh-1", { status: "OFF" });
    expect(service.update).toHaveBeenCalledWith("sh-1", { status: "OFF" });
    expect(result.status).toBe("OFF");
  });

  it("POST /api/v1/sales-humans/:id/reset-password delegates to service.resetPassword", async () => {
    const service = buildFakeService();
    const controller = new SalesHumansController(service);
    const result = await controller.resetPassword("sh-1", { password: "newpassword123" });
    expect(service.resetPassword).toHaveBeenCalledWith("sh-1", "newpassword123");
    expect(result).toEqual(SAMPLE);
  });

  it("guards the whole controller with ApiKeyGuard", () => {
    const guards = Reflect.getMetadata("__guards__", SalesHumansController) as unknown[];
    expect(guards).toContain(ApiKeyGuard);
  });
});

import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import type { SettingsResponseDto } from "./dto/settings-response.dto.js";
import type { WabaConfigResponseDto } from "./dto/waba-config.dto.js";
import { SettingsController } from "./settings.controller.js";
import type { SettingsService } from "./settings.service.js";

const SETTINGS_SAMPLE: SettingsResponseDto = {
  tenant: {
    tenantId: "dss-motor",
    name: "DSS Motor",
    vertical: "AUTOMOTIVE",
    status: "ACTIVE",
    mode: "LIVE",
  },
  meta: { apiVersion: "v21.0", hasToken: true, usingEnvDefault: true },
};

const WABA_SAMPLE: WabaConfigResponseDto = {
  id: "waba-1",
  branchId: "BINTARO",
  phoneNumber: "+628110000001",
  wabaId: "waba-1",
  phoneNumberId: "phone-1",
  maskedAccessToken: "tokexxxx",
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function buildFakeService(): SettingsService {
  return {
    getSettings: vi.fn(async () => SETTINGS_SAMPLE),
    updateMeta: vi.fn(async () => SETTINGS_SAMPLE),
    updateMode: vi.fn(async () => ({
      ...SETTINGS_SAMPLE,
      tenant: { ...SETTINGS_SAMPLE.tenant, mode: "DEV" as const },
    })),
    testMetaConnection: vi.fn(async () => ({ success: true, message: "Terhubung" })),
    listWaba: vi.fn(async () => [WABA_SAMPLE]),
    createWaba: vi.fn(async () => WABA_SAMPLE),
    updateWaba: vi.fn(async () => ({ ...WABA_SAMPLE, status: "INACTIVE" })),
    deleteWaba: vi.fn(async () => undefined),
    testWaba: vi.fn(async () => ({ success: true, message: "Terhubung" })),
    testWabaDraft: vi.fn(async () => ({ success: true, message: "Terhubung" })),
  } as unknown as SettingsService;
}

describe("SettingsController", () => {
  it("GET /api/v1/settings delegates to service.getSettings with the resolved tenant id", async () => {
    const service = buildFakeService();
    const controller = new SettingsController(service);
    const result = await controller.getSettings("dss-motor");
    expect(service.getSettings).toHaveBeenCalledWith("dss-motor");
    expect(result).toEqual(SETTINGS_SAMPLE);
  });

  it("PUT /api/v1/settings/meta delegates to service.updateMeta", async () => {
    const service = buildFakeService();
    const controller = new SettingsController(service);
    const body = { accessToken: "new-token" };
    await controller.updateMeta("dss-motor", body);
    expect(service.updateMeta).toHaveBeenCalledWith("dss-motor", body);
  });

  it("PATCH /api/v1/settings/mode delegates to service.updateMode", async () => {
    const service = buildFakeService();
    const controller = new SettingsController(service);
    const body = { mode: "DEV" as const, changedBy: "owner@dss-motor.test" };
    const result = await controller.updateMode("dss-motor", body);
    expect(service.updateMode).toHaveBeenCalledWith("dss-motor", body);
    expect(result.tenant.mode).toBe("DEV");
  });

  it("POST /api/v1/settings/meta/test delegates to service.testMetaConnection", async () => {
    const service = buildFakeService();
    const controller = new SettingsController(service);
    const result = await controller.testMeta("dss-motor");
    expect(service.testMetaConnection).toHaveBeenCalledWith("dss-motor");
    expect(result.success).toBe(true);
  });

  it("GET /api/v1/settings/waba delegates to service.listWaba", async () => {
    const service = buildFakeService();
    const controller = new SettingsController(service);
    const result = await controller.listWaba("dss-motor");
    expect(service.listWaba).toHaveBeenCalledWith("dss-motor");
    expect(result).toEqual([WABA_SAMPLE]);
  });

  it("POST /api/v1/settings/waba delegates to service.createWaba", async () => {
    const service = buildFakeService();
    const controller = new SettingsController(service);
    const body = {
      branchId: "BINTARO",
      phoneNumber: "+628110000001",
      wabaId: "waba-1",
      phoneNumberId: "phone-1",
      accessToken: "token-1",
    };
    await controller.createWaba("dss-motor", body);
    expect(service.createWaba).toHaveBeenCalledWith("dss-motor", body);
  });

  it("PUT /api/v1/settings/waba/:id delegates to service.updateWaba", async () => {
    const service = buildFakeService();
    const controller = new SettingsController(service);
    const result = await controller.updateWaba("dss-motor", "waba-1", { status: "INACTIVE" });
    expect(service.updateWaba).toHaveBeenCalledWith("dss-motor", "waba-1", { status: "INACTIVE" });
    expect(result.status).toBe("INACTIVE");
  });

  it("DELETE /api/v1/settings/waba/:id delegates to service.deleteWaba", async () => {
    const service = buildFakeService();
    const controller = new SettingsController(service);
    const result = await controller.deleteWaba("dss-motor", "waba-1");
    expect(service.deleteWaba).toHaveBeenCalledWith("dss-motor", "waba-1");
    expect(result).toEqual({ deleted: true });
  });

  it("POST /api/v1/settings/waba/:id/test delegates to service.testWaba", async () => {
    const service = buildFakeService();
    const controller = new SettingsController(service);
    const result = await controller.testWaba("dss-motor", "waba-1");
    expect(service.testWaba).toHaveBeenCalledWith("dss-motor", "waba-1");
    expect(result.success).toBe(true);
  });

  it("POST /api/v1/settings/waba/test-draft delegates to service.testWabaDraft (no tenant/DB read)", async () => {
    const service = buildFakeService();
    const controller = new SettingsController(service);
    const result = await controller.testWabaDraft({
      phoneNumberId: "phone-1",
      accessToken: "draft-token",
    });
    expect(service.testWabaDraft).toHaveBeenCalledWith("phone-1", "draft-token");
    expect(result.success).toBe(true);
  });

  it("guards the whole controller with ApiKeyGuard", () => {
    const guards = Reflect.getMetadata("__guards__", SettingsController) as unknown[];
    expect(guards).toContain(ApiKeyGuard);
  });
});

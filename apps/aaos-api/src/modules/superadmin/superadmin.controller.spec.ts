import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import type { TenantResponseDto } from "./dto/tenant-response.dto.js";
import { SuperadminController } from "./superadmin.controller.js";
import type { SuperadminService } from "./superadmin.service.js";

const SAMPLE: TenantResponseDto = {
  id: "t-1",
  tenantId: "dss-motor",
  name: "DSS Motor (Mobix)",
  vertical: "AUTOMOTIVE",
  status: "ACTIVE",
  hasMetaToken: false,
  wabaCount: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function buildFakeService(): SuperadminService {
  return {
    list: vi.fn(async () => ({
      kpi: { totalTenants: 1, activeTenants: 1, trialTenants: 0, suspendedTenants: 0 },
      tenants: [SAMPLE],
    })),
    create: vi.fn(async () => SAMPLE),
    update: vi.fn(async () => ({ ...SAMPLE, status: "SUSPENDED" })),
    impersonate: vi.fn(async () => ({
      tenantId: "dss-motor",
      adminEmail: "admin@dss-motor.id",
      actionLink: "https://example.test/verify",
    })),
  } as unknown as SuperadminService;
}

describe("SuperadminController", () => {
  it("GET /api/v1/superadmin/tenants delegates to service.list", async () => {
    const service = buildFakeService();
    const controller = new SuperadminController(service);
    const result = await controller.listTenants();
    expect(service.list).toHaveBeenCalled();
    expect(result.tenants).toEqual([SAMPLE]);
  });

  it("POST /api/v1/superadmin/tenants delegates to service.create", async () => {
    const service = buildFakeService();
    const controller = new SuperadminController(service);
    const body = {
      name: "DSS Motor (Mobix)",
      tenantId: "dss-motor",
      vertical: "AUTOMOTIVE" as const,
      adminEmail: "admin@dss-motor.id",
      adminPassword: "password123",
      status: "ACTIVE" as const,
    };
    const result = await controller.createTenant(body);
    expect(service.create).toHaveBeenCalledWith(body);
    expect(result).toEqual(SAMPLE);
  });

  it("PUT /api/v1/superadmin/tenants/:id delegates to service.update", async () => {
    const service = buildFakeService();
    const controller = new SuperadminController(service);
    const result = await controller.updateTenant("dss-motor", { status: "SUSPENDED" });
    expect(service.update).toHaveBeenCalledWith("dss-motor", { status: "SUSPENDED" });
    expect(result.status).toBe("SUSPENDED");
  });

  it("POST /api/v1/superadmin/impersonate delegates to service.impersonate", async () => {
    const service = buildFakeService();
    const controller = new SuperadminController(service);
    const body = { tenantId: "dss-motor", actorEmail: "superadmin@aaos.id", actorId: "s-1" };
    const result = await controller.impersonate(body);
    expect(service.impersonate).toHaveBeenCalledWith(body);
    expect(result.actionLink).toContain("https://");
  });

  it("guards the whole controller with ApiKeyGuard", () => {
    const guards = Reflect.getMetadata("__guards__", SuperadminController) as unknown[];
    expect(guards).toContain(ApiKeyGuard);
  });
});

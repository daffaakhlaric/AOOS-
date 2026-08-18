import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { CreativePackagesController } from "./creative-packages.controller.js";
import type { CreativePackagesService } from "./creative-packages.service.js";
import {
  CreatePackageBodySchema,
  GetLogsQuerySchema,
  GetPackagesQuerySchema,
} from "./dto/create-package.dto.js";
import type {
  CreativePackageDetailResponseDto,
  CreativePackageResponseDto,
} from "./dto/creative-package-response.dto.js";

function buildFakeService(): CreativePackagesService {
  return {
    list: vi.fn(async () => [{ id: "pkg-1", status: "PENDING" }] as CreativePackageResponseDto[]),
    byId: vi.fn(
      async () =>
        ({ package: { id: "pkg-1" }, logs: [] }) as unknown as CreativePackageDetailResponseDto,
    ),
    logs: vi.fn(async () => [{ id: "log-1", eventType: "BRIEF_SENT" }]),
    create: vi.fn(async () => ({ id: "pkg-1", status: "DRAFT" }) as CreativePackageResponseDto),
    generate: vi.fn(
      async () => ({ id: "pkg-1", status: "GENERATING" }) as CreativePackageResponseDto,
    ),
    approve: vi.fn(async () => ({ id: "pkg-1", status: "APPROVED" }) as CreativePackageResponseDto),
    reject: vi.fn(async () => ({ id: "pkg-1", status: "REJECTED" }) as CreativePackageResponseDto),
  } as unknown as CreativePackagesService;
}

describe("CreativePackagesController", () => {
  it("GET /api/v1/creative-packages delegates to list with the validated query", async () => {
    const service = buildFakeService();
    const controller = new CreativePackagesController(service);
    const query = GetPackagesQuerySchema.parse({ status: "PENDING" });
    await expect(controller.list(query)).resolves.toEqual([{ id: "pkg-1", status: "PENDING" }]);
    expect(service.list).toHaveBeenCalledWith(query);
  });

  it("GET /api/v1/creative-packages/logs delegates to logs (declared before :id so it is not shadowed)", async () => {
    const service = buildFakeService();
    const controller = new CreativePackagesController(service);
    const query = GetLogsQuerySchema.parse({ eventType: "GENERATE" });
    await controller.logs(query);
    expect(service.logs).toHaveBeenCalledWith(query);
    // Route order is load-bearing: `logs` must be registered before the `:id` param route.
    const routes = (
      Reflect.ownKeys(CreativePackagesController.prototype) as readonly string[]
    ).filter((key) => key !== "constructor");
    expect(routes.indexOf("logs")).toBeLessThan(routes.indexOf("byId"));
  });

  it("GET /api/v1/creative-packages/:id delegates to byId", async () => {
    const service = buildFakeService();
    const controller = new CreativePackagesController(service);
    await controller.byId("pkg-1");
    expect(service.byId).toHaveBeenCalledWith("pkg-1");
  });

  it("POST /api/v1/creative-packages delegates to create", async () => {
    const service = buildFakeService();
    const controller = new CreativePackagesController(service);
    const body = CreatePackageBodySchema.parse({
      unit: "xpander-gls-2022-001",
      branch: "CINERE",
      angle: "DP_RINGAN",
      primaryMessage: "DP mulai 29 juta",
      format: "IMAGES_ONLY",
    });
    await expect(controller.create(body)).resolves.toEqual({ id: "pkg-1", status: "DRAFT" });
    expect(service.create).toHaveBeenCalledWith(body);
  });

  it("POST /api/v1/creative-packages/:id/generate delegates to generate", async () => {
    const service = buildFakeService();
    const controller = new CreativePackagesController(service);
    await expect(controller.generate("pkg-1")).resolves.toEqual({
      id: "pkg-1",
      status: "GENERATING",
    });
    expect(service.generate).toHaveBeenCalledWith("pkg-1");
  });

  it("POST /api/v1/creative-packages/:id/approve delegates to approve with id + body", async () => {
    const service = buildFakeService();
    const controller = new CreativePackagesController(service);
    await expect(controller.approve("pkg-1", { selectedCopyVariantId: "v-a" })).resolves.toEqual({
      id: "pkg-1",
      status: "APPROVED",
    });
    expect(service.approve).toHaveBeenCalledWith(
      "pkg-1",
      { selectedCopyVariantId: "v-a" },
      expect.any(Date),
    );
  });

  it("POST /api/v1/creative-packages/:id/reject delegates to reject with id + body", async () => {
    const service = buildFakeService();
    const controller = new CreativePackagesController(service);
    await expect(controller.reject("pkg-1", { reason: "not on-brand" })).resolves.toEqual({
      id: "pkg-1",
      status: "REJECTED",
    });
    expect(service.reject).toHaveBeenCalledWith(
      "pkg-1",
      { reason: "not on-brand" },
      expect.any(Date),
    );
  });

  it("guards the whole controller with ApiKeyGuard", () => {
    const guards = Reflect.getMetadata("__guards__", CreativePackagesController) as unknown[];
    expect(guards).toContain(ApiKeyGuard);
  });

  it("exposes no settings endpoint — there is no auto mode to configure", () => {
    const routes = Reflect.ownKeys(CreativePackagesController.prototype) as readonly string[];
    expect(routes).not.toContain("settings");
  });
});

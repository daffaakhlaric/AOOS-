import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { CreativePackagesController } from "./creative-packages.controller.js";
import type { CreativePackagesService } from "./creative-packages.service.js";
import type { CreativePackageResponseDto } from "./dto/creative-package-response.dto.js";

function buildFakeService(): CreativePackagesService {
  return {
    listPending: vi.fn(() => [{ id: "pkg-1", status: "PENDING" }] as CreativePackageResponseDto[]),
    approve: vi.fn(() => ({ id: "pkg-1", status: "APPROVED" }) as CreativePackageResponseDto),
    reject: vi.fn(() => ({ id: "pkg-1", status: "REJECTED" }) as CreativePackageResponseDto),
  } as unknown as CreativePackagesService;
}

describe("CreativePackagesController", () => {
  it("GET /api/v1/creative-packages delegates to listPending", () => {
    const service = buildFakeService();
    const controller = new CreativePackagesController(service);
    expect(controller.listPending()).toEqual([{ id: "pkg-1", status: "PENDING" }]);
    expect(service.listPending).toHaveBeenCalled();
  });

  it("POST /api/v1/creative-packages/:id/approve delegates to approve with id + body", () => {
    const service = buildFakeService();
    const controller = new CreativePackagesController(service);
    const result = controller.approve("pkg-1", { selectedCopyVariantId: "v-a" });
    expect(service.approve).toHaveBeenCalledWith(
      "pkg-1",
      { selectedCopyVariantId: "v-a" },
      expect.any(Date),
    );
    expect(result).toEqual({ id: "pkg-1", status: "APPROVED" });
  });

  it("POST /api/v1/creative-packages/:id/reject delegates to reject with id + body", () => {
    const service = buildFakeService();
    const controller = new CreativePackagesController(service);
    const result = controller.reject("pkg-1", { reason: "not on-brand" });
    expect(service.reject).toHaveBeenCalledWith(
      "pkg-1",
      { reason: "not on-brand" },
      expect.any(Date),
    );
    expect(result).toEqual({ id: "pkg-1", status: "REJECTED" });
  });

  it("guards the whole controller with ApiKeyGuard", () => {
    const guards = Reflect.getMetadata("__guards__", CreativePackagesController) as unknown[];
    expect(guards).toContain(ApiKeyGuard);
  });
});

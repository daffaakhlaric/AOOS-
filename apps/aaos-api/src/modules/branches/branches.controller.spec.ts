import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { buildTestConfig } from "../../test-support/fixtures.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { BranchesController } from "./branches.controller.js";
import type { BranchesService } from "./branches.service.js";
import type { BranchResponseDto } from "./dto/branch-response.dto.js";

function buildFakeService(): BranchesService {
  return {
    listBranches: vi.fn(() => [{ id: "BINTARO" }] as unknown as BranchResponseDto[]),
    updateBranch: vi.fn(async () => ({ id: "BINTARO" }) as unknown as BranchResponseDto),
  } as unknown as BranchesService;
}

describe("BranchesController", () => {
  it("GET /api/v1/branches delegates to BranchesService.listBranches", () => {
    const service = buildFakeService();
    const controller = new BranchesController(service, buildTestConfig());
    expect(controller.listBranches()).toEqual([{ id: "BINTARO" }]);
    expect(service.listBranches).toHaveBeenCalled();
  });

  it("PUT /api/v1/branches/:id delegates to BranchesService.updateBranch with id/body/tenant/correlation", async () => {
    const service = buildFakeService();
    const config = buildTestConfig({ AAOS_TENANT_ID: "dss-motor" });
    const controller = new BranchesController(service, config);
    const body = { assignmentMode: "ROUND_ROBIN" as const };
    const result = await controller.updateBranch("BINTARO", body, "corr-1");
    expect(service.updateBranch).toHaveBeenCalledWith("BINTARO", body, "dss-motor", "corr-1");
    expect(result).toEqual({ id: "BINTARO" });
  });

  it("guards the whole controller with ApiKeyGuard", () => {
    const guards = Reflect.getMetadata("__guards__", BranchesController) as unknown[];
    expect(guards).toContain(ApiKeyGuard);
  });
});

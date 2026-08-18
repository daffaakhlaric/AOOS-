import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { MetaInterestsController } from "./meta-interests.controller.js";
import type { MetaInterestsService } from "./meta-interests.service.js";

function buildFakeService(): MetaInterestsService {
  return {
    sync: vi.fn(async () => ({
      tenantId: "dss-motor",
      fetchedAt: "2026-08-18T00:00:00.000Z",
      terms: [],
      totalInserted: 0,
      totalUpdated: 0,
    })),
    list: vi.fn(async () => []),
  } as unknown as MetaInterestsService;
}

describe("MetaInterestsController", () => {
  it("POST sync delegates to MetaInterestsService.sync", async () => {
    const service = buildFakeService();
    const controller = new MetaInterestsController(service);
    const body = { terms: ["used car"] };
    const result = await controller.sync(body);
    expect(service.sync).toHaveBeenCalledWith(body);
    expect(result.totalInserted).toBe(0);
  });

  it("GET / delegates to MetaInterestsService.list", async () => {
    const service = buildFakeService();
    const controller = new MetaInterestsController(service);
    expect(await controller.list()).toEqual([]);
    expect(service.list).toHaveBeenCalledTimes(1);
  });

  it("is guarded by ApiKeyGuard — a real live Meta call must never be triggerable unauthenticated", () => {
    const guards = Reflect.getMetadata("__guards__", MetaInterestsController) as unknown[];
    expect(guards).toContain(ApiKeyGuard);
  });

  it("is mounted at api/v1/meta-interests", () => {
    expect(Reflect.getMetadata("path", MetaInterestsController)).toBe("api/v1/meta-interests");
  });
});

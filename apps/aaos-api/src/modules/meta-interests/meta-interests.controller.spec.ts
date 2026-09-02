import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { GetMetaInterestsQuerySchema, SyncInterestsBodySchema } from "./dto/sync-interests.dto.js";
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
  it("POST sync delegates to MetaInterestsService.sync with the caller's explicit tenantId", async () => {
    const service = buildFakeService();
    const controller = new MetaInterestsController(service);
    const body = { tenantId: "dss-motor", terms: ["used car"] };
    const result = await controller.sync(body);
    expect(service.sync).toHaveBeenCalledWith(body);
    expect(result.totalInserted).toBe(0);
  });

  it("GET / delegates to MetaInterestsService.list with the caller's explicit tenantId", async () => {
    const service = buildFakeService();
    const controller = new MetaInterestsController(service);
    expect(await controller.list({ tenantId: "dss-motor" })).toEqual([]);
    expect(service.list).toHaveBeenCalledWith("dss-motor");
  });

  it("is guarded by ApiKeyGuard — a real live Meta call must never be triggerable unauthenticated", () => {
    const guards = Reflect.getMetadata("__guards__", MetaInterestsController) as unknown[];
    expect(guards).toContain(ApiKeyGuard);
  });

  it("is mounted at api/v1/meta-interests", () => {
    expect(Reflect.getMetadata("path", MetaInterestsController)).toBe("api/v1/meta-interests");
  });
});

describe("meta-interests DTO validation — tenantId is REQUIRED, never defaulted (Phase T1 fix)", () => {
  it("SyncInterestsBodySchema rejects a missing tenantId", () => {
    expect(SyncInterestsBodySchema.safeParse({ terms: ["used car"] }).success).toBe(false);
  });

  it("SyncInterestsBodySchema rejects an empty-string tenantId", () => {
    expect(SyncInterestsBodySchema.safeParse({ tenantId: "" }).success).toBe(false);
  });

  it("SyncInterestsBodySchema accepts a real explicit tenantId with everything else optional", () => {
    expect(SyncInterestsBodySchema.safeParse({ tenantId: "dss-motor" }).success).toBe(true);
  });

  it("GetMetaInterestsQuerySchema rejects a missing tenantId", () => {
    expect(GetMetaInterestsQuerySchema.safeParse({}).success).toBe(false);
  });

  it("GetMetaInterestsQuerySchema accepts a real explicit tenantId", () => {
    expect(GetMetaInterestsQuerySchema.safeParse({ tenantId: "dss-motor" }).success).toBe(true);
  });
});

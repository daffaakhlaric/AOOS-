import "reflect-metadata";

import { AssetStatus, AssetType } from "@aos/asset-library";
import { describe, expect, it, vi } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { AssetsController } from "./assets.controller.js";
import { AssetsModule } from "./assets.module.js";
import { AssetsService } from "./assets.service.js";
import { GetAssetsQuerySchema, DownloadQuerySchema } from "./dto/assets.dto.js";

function buildFakeService(): AssetsService {
  return {
    list: vi.fn(async () => ({ assets: [], total: 0, page: 1, limit: 48 })),
    stats: vi.fn(async () => ({
      totalAssets: 0,
      byType: {},
      byBranch: {},
      byStatus: {},
      totalSizeBytes: 0,
    })),
    byId: vi.fn(async () => ({ id: "asset-1", status: AssetStatus.ACTIVE })),
    archive: vi.fn(async () => ({ id: "asset-1", status: AssetStatus.ARCHIVED })),
    downloadUrl: vi.fn(async () => ({ url: "https://signed", expiresInSeconds: 3600 })),
  } as unknown as AssetsService;
}

const TENANT_ID = "dss-motor";

describe("AssetsController", () => {
  it("GET / delegates to AssetsService.list with the real per-request tenantId", async () => {
    const service = buildFakeService();
    const query = { page: 1, limit: 48, sort: "newest" as const };
    await new AssetsController(service).list(query, TENANT_ID);
    expect(service.list).toHaveBeenCalledWith(query, TENANT_ID);
  });

  it("GET stats delegates to AssetsService.stats with the real per-request tenantId", async () => {
    const service = buildFakeService();
    await new AssetsController(service).stats(TENANT_ID);
    expect(service.stats).toHaveBeenCalledWith(TENANT_ID);
  });

  it("GET :id delegates to AssetsService.byId", async () => {
    const service = buildFakeService();
    await new AssetsController(service).byId("asset-1");
    expect(service.byId).toHaveBeenCalledWith("asset-1");
  });

  it("GET :id/download delegates to AssetsService.downloadUrl", async () => {
    const service = buildFakeService();
    const result = await new AssetsController(service).download("asset-1", { expiresIn: 900 });
    expect(service.downloadUrl).toHaveBeenCalledWith("asset-1", { expiresIn: 900 });
    expect(result.url).toBe("https://signed");
  });

  it("DELETE :id ARCHIVES (soft delete) with the real per-request tenantId and returns the ARCHIVED asset, not { deleted: true }", async () => {
    const service = buildFakeService();
    const result = await new AssetsController(service).archive("asset-1", TENANT_ID);
    expect(service.archive).toHaveBeenCalledWith("asset-1", TENANT_ID);
    expect(result.status).toBe(AssetStatus.ARCHIVED);
    expect(result).not.toHaveProperty("deleted");
  });

  it("declares stats/:id/download before the bare :id route so they are not shadowed", () => {
    // Nest matches in declaration order; `stats` and `:id/download` must be declared first.
    const methods = Object.getOwnPropertyNames(AssetsController.prototype).filter(
      (name) => name !== "constructor",
    );
    expect(methods.indexOf("stats")).toBeLessThan(methods.indexOf("byId"));
    expect(methods.indexOf("download")).toBeLessThan(methods.indexOf("byId"));
  });
});

describe("Assets DTO validation", () => {
  it("accepts only REAL AssetType members — no fabricated 'ALL' sentinel", () => {
    expect(GetAssetsQuerySchema.safeParse({ type: "UNIT_PHOTO" }).success).toBe(true);
    expect(GetAssetsQuerySchema.safeParse({ type: "ALL" }).success).toBe(false);
    expect(GetAssetsQuerySchema.safeParse({ type: "PROMO" }).success).toBe(false);
  });

  it("accepts only REAL AssetStatus members — REJECTED is not a state in this domain", () => {
    expect(GetAssetsQuerySchema.safeParse({ status: AssetStatus.ARCHIVED }).success).toBe(true);
    expect(GetAssetsQuerySchema.safeParse({ status: "REJECTED" }).success).toBe(false);
  });

  it("rejects a fabricated branch", () => {
    expect(GetAssetsQuerySchema.safeParse({ branch: "CINERE" }).success).toBe(true);
    expect(GetAssetsQuerySchema.safeParse({ branch: "PONDOK_BAMBU" }).success).toBe(false);
  });

  it("defaults page/limit/sort and caps limit at 200", () => {
    const parsed = GetAssetsQuerySchema.parse({});
    expect(parsed).toMatchObject({ page: 1, limit: 48, sort: "newest" });
    expect(GetAssetsQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
  });

  it("coerces numeric query strings (they always arrive as strings over HTTP)", () => {
    expect(GetAssetsQuerySchema.parse({ page: "3", limit: "12" })).toMatchObject({
      page: 3,
      limit: 12,
    });
  });

  it("download expiresIn defaults to 1 hour and is capped at 24 hours", () => {
    expect(DownloadQuerySchema.parse({})).toEqual({ expiresIn: 3600 });
    expect(DownloadQuerySchema.safeParse({ expiresIn: "86401" }).success).toBe(false);
    expect(DownloadQuerySchema.safeParse({ expiresIn: "0" }).success).toBe(false);
  });

  it("exposes the real AssetType union the migration documents", () => {
    expect(Object.values(AssetType)).toEqual([
      "UNIT_PHOTO",
      "BRAND",
      "TESTIMONIAL",
      "AI_VIDEO",
      "AI_IMAGE",
      "OVERLAY",
    ]);
  });
});

describe("AssetsModule", () => {
  it("registers AssetsController plus AssetsService/ApiKeyGuard", () => {
    expect(Reflect.getMetadata("controllers", AssetsModule)).toEqual([AssetsController]);
    const providers = Reflect.getMetadata("providers", AssetsModule) as unknown[];
    expect(providers).toContain(AssetsService);
    expect(providers).toContain(ApiKeyGuard);
  });
});

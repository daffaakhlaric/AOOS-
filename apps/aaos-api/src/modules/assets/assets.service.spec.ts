import {
  AssetBuilder,
  AssetError,
  AssetNotFoundError,
  AssetStatus,
  AssetType,
  StorageError,
  type Asset,
  type AssetLibrary,
} from "@aos/asset-library";
import { err, ok } from "@aos/common";
import { UnavailableError } from "@aos/errors";
import { Branch } from "@aos/meta-ads-connector";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssetsService } from "./assets.service.js";

const TENANT_ID = "dss-motor";

function asset(overrides: (builder: AssetBuilder) => AssetBuilder = (b) => b): Asset {
  const result = overrides(
    new AssetBuilder()
      .withTenantId("dss-motor")
      .withType(AssetType.UNIT_PHOTO)
      .withStatus(AssetStatus.ACTIVE)
      .withBranch(Branch.CINERE)
      .withUnitId("xpander-cross-2019")
      .withUnitModel("Xpander Cross")
      .withUnitYear(2019)
      .withFileName("foto-1.jpg")
      .withFileSize(2_400_000),
  ).build();
  if (!result.ok) {
    throw new Error(`fixture setup failed: ${result.error.message}`);
  }
  return result.value;
}

interface Library {
  readonly library: AssetLibrary;
  readonly listAssets: ReturnType<typeof vi.fn>;
  readonly getAssetStats: ReturnType<typeof vi.fn>;
  readonly getAsset: ReturnType<typeof vi.fn>;
  readonly archiveAsset: ReturnType<typeof vi.fn>;
  readonly getSignedUrl: ReturnType<typeof vi.fn>;
}

function createLibrary(overrides: Partial<Record<string, unknown>> = {}): Library {
  const listAssets = vi.fn(async () => ok({ assets: [asset()], total: 1, page: 1, limit: 48 }));
  const getAssetStats = vi.fn(async () =>
    ok({
      totalAssets: 412,
      byType: {
        [AssetType.UNIT_PHOTO]: 312,
        [AssetType.AI_VIDEO]: 18,
        [AssetType.AI_IMAGE]: 82,
        [AssetType.BRAND]: 0,
        [AssetType.TESTIMONIAL]: 0,
        [AssetType.OVERLAY]: 0,
      },
      byBranch: { CINERE: 18 },
      byStatus: {
        [AssetStatus.ACTIVE]: 412,
        [AssetStatus.ARCHIVED]: 0,
        [AssetStatus.PENDING]: 0,
      },
      totalSizeBytes: 1_234_567,
    }),
  );
  const getAsset = vi.fn(async () => ok(asset()));
  const archiveAsset = vi.fn(async () => ok(asset((b) => b.withStatus(AssetStatus.ARCHIVED))));
  const getSignedUrl = vi.fn(async () =>
    ok("https://storage.googleapis.com/aoos/units/x/foto-1.jpg?X-Goog-Signature=fake"),
  );

  const library = {
    listAssets: { execute: listAssets },
    getAssetStats: { execute: getAssetStats },
    getAsset: { execute: getAsset },
    archiveAsset: { execute: archiveAsset },
    assetStorage: { getSignedUrl },
    ...overrides,
  } as unknown as AssetLibrary;

  return { library, listAssets, getAssetStats, getAsset, archiveAsset, getSignedUrl };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AssetsService — graceful degradation with no GCS configured", () => {
  it("list raises UnavailableError (→503) naming the missing env vars, never an empty list", async () => {
    const service = new AssetsService(undefined);
    await expect(service.list({ page: 1, limit: 48, sort: "newest" }, TENANT_ID)).rejects.toThrow(
      UnavailableError,
    );
    await expect(service.list({ page: 1, limit: 48, sort: "newest" }, TENANT_ID)).rejects.toThrow(
      /GCS_PROJECT_ID/,
    );
  });

  it("every other endpoint degrades the same way", async () => {
    const service = new AssetsService(undefined);
    await expect(service.stats(TENANT_ID)).rejects.toThrow(UnavailableError);
    await expect(service.byId("a")).rejects.toThrow(UnavailableError);
    await expect(service.archive("a", TENANT_ID)).rejects.toThrow(UnavailableError);
    await expect(service.downloadUrl("a", { expiresIn: 3600 })).rejects.toThrow(UnavailableError);
  });
});

describe("AssetsService.list", () => {
  it("maps real Asset entities to DTOs", async () => {
    const { library } = createLibrary();
    const service = new AssetsService(library);
    const page = await service.list({ page: 1, limit: 48, sort: "newest" }, TENANT_ID);

    expect(page.total).toBe(1);
    const dto = page.assets[0];
    expect(dto?.type).toBe(AssetType.UNIT_PHOTO);
    expect(dto?.status).toBe(AssetStatus.ACTIVE);
    expect(dto?.fileName).toBe("foto-1.jpg");
    expect(dto?.fileSize).toBe(2_400_000);
    expect(dto?.unitModel).toBe("Xpander Cross");
    expect(dto?.branch).toBe("CINERE");
  });

  it("never emits fabricated width/height/durationSeconds/usedInPackages fields", async () => {
    const { library } = createLibrary();
    const service = new AssetsService(library);
    const page = await service.list({ page: 1, limit: 48, sort: "newest" }, TENANT_ID);
    const dto = page.assets[0] as Record<string, unknown>;
    for (const key of [
      "width",
      "height",
      "durationSeconds",
      "usedInPackages",
      "source",
      "isMainPhoto",
    ]) {
      expect(dto).not.toHaveProperty(key);
    }
  });

  it("always scopes the query to the real per-request tenant", async () => {
    const { library, listAssets } = createLibrary();
    const service = new AssetsService(library);
    await service.list({ page: 1, limit: 48, sort: "newest" }, "dss-motor");
    expect(listAssets).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "dss-motor" }));
  });

  it("forwards only the filters the caller actually supplied", async () => {
    const { library, listAssets } = createLibrary();
    const service = new AssetsService(library);
    await service.list(
      {
        page: 2,
        limit: 12,
        sort: "oldest",
        type: AssetType.AI_VIDEO,
        branch: Branch.BINTARO,
      },
      TENANT_ID,
    );
    expect(listAssets).toHaveBeenCalledWith({
      tenantId: "dss-motor",
      type: AssetType.AI_VIDEO,
      branch: Branch.BINTARO,
      page: 2,
      limit: 12,
      sort: "oldest",
    });
  });

  it("forwards the AAOS-CREATIVE-REVIEW `model` filter through to the library", async () => {
    const { library, listAssets } = createLibrary();
    const service = new AssetsService(library);
    await service.list({ page: 1, limit: 48, sort: "newest", model: "xpander" }, TENANT_ID);
    expect(listAssets).toHaveBeenCalledWith(expect.objectContaining({ model: "xpander" }));
  });

  it("re-throws the library's domain error for AaosExceptionFilter to map", async () => {
    const { library } = createLibrary({
      listAssets: { execute: vi.fn(async () => err(new StorageError("postgrest down"))) },
    });
    const service = new AssetsService(library);
    await expect(service.list({ page: 1, limit: 48, sort: "newest" }, TENANT_ID)).rejects.toThrow(
      AssetError,
    );
  });
});

describe("AssetsService.stats", () => {
  it("returns real aggregate counts", async () => {
    const { library } = createLibrary();
    const service = new AssetsService(library);
    const stats = await service.stats(TENANT_ID);
    expect(stats.totalAssets).toBe(412);
    expect(stats.byType[AssetType.UNIT_PHOTO]).toBe(312);
    expect(stats.totalSizeBytes).toBe(1_234_567);
  });

  it("scopes to the real per-request tenant", async () => {
    const { library, getAssetStats } = createLibrary();
    const service = new AssetsService(library);
    await service.stats("dss-motor");
    expect(getAssetStats).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "dss-motor" }));
  });

  it("re-throws a repository failure", async () => {
    const { library } = createLibrary({
      getAssetStats: { execute: vi.fn(async () => err(new StorageError("boom"))) },
    });
    const service = new AssetsService(library);
    await expect(service.stats(TENANT_ID)).rejects.toThrow(AssetError);
  });
});

describe("AssetsService.byId", () => {
  it("returns the mapped asset", async () => {
    const { library } = createLibrary();
    const service = new AssetsService(library);
    const dto = await service.byId("asset-1");
    expect(dto.fileName).toBe("foto-1.jpg");
  });

  it("re-throws AssetNotFoundError (mapped to 404 by the exception filter, not here)", async () => {
    const { library } = createLibrary({
      getAsset: { execute: vi.fn(async () => err(new AssetNotFoundError("Asset not found: x"))) },
    });
    const service = new AssetsService(library);
    await expect(service.byId("x")).rejects.toThrow(AssetNotFoundError);
  });
});

describe("AssetsService.archive — SOFT delete only", () => {
  it("calls the real ArchiveAsset use case and returns the ARCHIVED asset", async () => {
    const { library, archiveAsset } = createLibrary();
    const service = new AssetsService(library);
    const dto = await service.archive("asset-1", TENANT_ID);

    expect(archiveAsset).toHaveBeenCalledWith(
      expect.objectContaining({ id: "asset-1", tenantId: "dss-motor" }),
    );
    expect(dto.status).toBe(AssetStatus.ARCHIVED);
  });

  it("passes a real correlationId through to the use case", async () => {
    const { library, archiveAsset } = createLibrary();
    await new AssetsService(library).archive("asset-1", TENANT_ID);
    const input = archiveAsset.mock.calls[0]?.[0] as { correlationId: string };
    expect(input.correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("re-throws AssetNotFoundError for an unknown id", async () => {
    const { library } = createLibrary({
      archiveAsset: {
        execute: vi.fn(async () => err(new AssetNotFoundError("Asset not found: x"))),
      },
    });
    await expect(new AssetsService(library).archive("x", TENANT_ID)).rejects.toThrow(
      AssetNotFoundError,
    );
  });
});

describe("AssetsService.downloadUrl", () => {
  it("signs the asset's REAL storage path (not its public URL)", async () => {
    const { library, getSignedUrl } = createLibrary();
    const service = new AssetsService(library);
    const result = await service.downloadUrl("asset-1", { expiresIn: 900 });

    expect(getSignedUrl).toHaveBeenCalledWith("units/unit-001/photo-1700000000000.jpg", 900);
    expect(result.url).toContain("X-Goog-Signature");
    expect(result.expiresInSeconds).toBe(900);
  });

  it("re-throws when the asset does not exist (no signing attempted)", async () => {
    const { library, getSignedUrl } = createLibrary({
      getAsset: { execute: vi.fn(async () => err(new AssetNotFoundError("nope"))) },
    });
    const service = new AssetsService(library);
    await expect(service.downloadUrl("x", { expiresIn: 3600 })).rejects.toThrow(AssetNotFoundError);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it("re-throws a StorageError when GCS cannot sign", async () => {
    const { library } = createLibrary({
      assetStorage: {
        getSignedUrl: vi.fn(async () => err(new StorageError("cannot sign without a private key"))),
      },
    });
    const service = new AssetsService(library);
    await expect(service.downloadUrl("asset-1", { expiresIn: 3600 })).rejects.toThrow(StorageError);
  });
});

import { describe, expect, it, vi } from "vitest";

import type { InsightRow } from "../metric-snapshot/infrastructure/metric-snapshot.repository.js";

import { CreativeMemoryService } from "./creative-memory.service.js";
import type {
  CreativeMemoryRepository,
  PublishedAssetRow,
  PublishedPackageRow,
} from "./infrastructure/creative-memory.repository.js";

const TENANT = "propertyklik-demo";

function pkgRow(overrides: Partial<PublishedPackageRow> = {}): PublishedPackageRow {
  return {
    id: "pkg-1",
    angle: "URGENCY",
    publishedMetaAdIds: ["meta-ad-1"],
    fatigueStatus: "NORMAL",
    generatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function assetRow(overrides: Partial<PublishedAssetRow> = {}): PublishedAssetRow {
  return {
    id: "pkg-1",
    angle: "URGENCY",
    title: "Rumah Minimalis BSD",
    publishedMetaAdIds: ["meta-ad-1"],
    fatigueStatus: "NORMAL",
    generatedAt: "2026-01-01T00:00:00.000Z",
    hasVideo: false,
    imageCount: 3,
    ...overrides,
  };
}

function row(overrides: Partial<InsightRow> = {}): InsightRow {
  return {
    date: "2026-01-15",
    spend: 100_000,
    impressions: 1_000,
    clicks: 20,
    reach: 900,
    leads: 2,
    ...overrides,
  };
}

function buildFakeRepository(
  packages: readonly PublishedPackageRow[],
  insightRowsByAdId: Record<string, readonly InsightRow[]> = {},
  assets: readonly PublishedAssetRow[] = [],
): CreativeMemoryRepository {
  return {
    listPublishedPropertyPackages: vi.fn(async () => packages),
    listPublishedPropertyAssets: vi.fn(async () => assets),
    getAdInsightRows: vi.fn(async (_tenantId: string, metaAdIds: readonly string[]) =>
      metaAdIds.flatMap((id) => insightRowsByAdId[id] ?? []),
    ),
  } as unknown as CreativeMemoryRepository;
}

describe("CreativeMemoryService", () => {
  describe("getAnglePerformance", () => {
    it("returns an honest empty angles: [] when no PROPERTY package has ever been published — never throws", async () => {
      const repository = buildFakeRepository([]);
      const service = new CreativeMemoryService(repository);
      const result = await service.getAnglePerformance(TENANT);
      expect(result).toEqual({ angles: [] });
      expect(repository.getAdInsightRows).not.toHaveBeenCalled();
    });

    it("resolves each package's own published Meta ad ids to real insight rows and ranks by angle", async () => {
      const repository = buildFakeRepository(
        [pkgRow({ id: "pkg-1", angle: "URGENCY", publishedMetaAdIds: ["meta-ad-1"] })],
        { "meta-ad-1": [row({ spend: 50_000, leads: 1 })] },
      );
      const service = new CreativeMemoryService(repository);
      const result = await service.getAnglePerformance(TENANT);
      expect(result.angles).toHaveLength(1);
      expect(result.angles[0]?.angle).toBe("URGENCY");
      expect(result.angles[0]?.aggregated.spend).toBe(50_000);
    });

    it("passes tenantId and each package's own publishedMetaAdIds to the repository", async () => {
      const repository = buildFakeRepository([
        pkgRow({ id: "pkg-1", angle: "A", publishedMetaAdIds: ["ad-1", "ad-2"] }),
      ]);
      const service = new CreativeMemoryService(repository);
      await service.getAnglePerformance(TENANT);
      expect(repository.getAdInsightRows).toHaveBeenCalledWith(TENANT, ["ad-1", "ad-2"], undefined);
    });

    it("passes the given window through to every repository insight-row lookup", async () => {
      const repository = buildFakeRepository([pkgRow()]);
      const service = new CreativeMemoryService(repository);
      const window = { start: "2026-01-01", end: "2026-01-31" };
      await service.getAnglePerformance(TENANT, window);
      expect(repository.getAdInsightRows).toHaveBeenCalledWith(TENANT, ["meta-ad-1"], window);
    });

    it("groups two packages sharing the same angle into one AnglePerformanceResult", async () => {
      const repository = buildFakeRepository(
        [
          pkgRow({ id: "pkg-1", angle: "URGENCY", publishedMetaAdIds: ["ad-1"] }),
          pkgRow({ id: "pkg-2", angle: "URGENCY", publishedMetaAdIds: ["ad-2"] }),
        ],
        { "ad-1": [row({ leads: 1 })], "ad-2": [row({ leads: 1 })] },
      );
      const service = new CreativeMemoryService(repository);
      const result = await service.getAnglePerformance(TENANT);
      expect(result.angles).toHaveLength(1);
      expect(result.angles[0]?.packageCount).toBe(2);
    });
  });

  describe("getAssetPerformance", () => {
    it("returns an honest empty assets: [] when no PROPERTY asset has ever been published — never throws", async () => {
      const repository = buildFakeRepository([], {}, []);
      const service = new CreativeMemoryService(repository);
      const result = await service.getAssetPerformance(TENANT);
      expect(result).toEqual({ assets: [] });
      expect(repository.getAdInsightRows).not.toHaveBeenCalled();
    });

    it("resolves each asset's own published Meta ad ids to real insight rows, one result per asset (never grouped)", async () => {
      const repository = buildFakeRepository([], {}, [
        assetRow({ id: "pkg-1", angle: "URGENCY", publishedMetaAdIds: ["meta-ad-1"] }),
        assetRow({ id: "pkg-2", angle: "URGENCY", publishedMetaAdIds: ["meta-ad-2"] }),
      ]);
      const service = new CreativeMemoryService(repository);
      const result = await service.getAssetPerformance(TENANT);
      expect(result.assets).toHaveLength(2);
      const ids = result.assets.map((a) => a.packageId).sort();
      expect(ids).toEqual(["pkg-1", "pkg-2"]);
    });

    it("passes tenantId and each asset's own publishedMetaAdIds to the repository", async () => {
      const repository = buildFakeRepository([], {}, [
        assetRow({ id: "pkg-1", publishedMetaAdIds: ["ad-1", "ad-2"] }),
      ]);
      const service = new CreativeMemoryService(repository);
      await service.getAssetPerformance(TENANT);
      expect(repository.getAdInsightRows).toHaveBeenCalledWith(TENANT, ["ad-1", "ad-2"], undefined);
    });

    it("passes the given window through to every repository insight-row lookup", async () => {
      const repository = buildFakeRepository([], {}, [assetRow()]);
      const service = new CreativeMemoryService(repository);
      const window = { start: "2026-01-01", end: "2026-01-31" };
      await service.getAssetPerformance(TENANT, window);
      expect(repository.getAdInsightRows).toHaveBeenCalledWith(TENANT, ["meta-ad-1"], window);
    });

    it("carries through the real asset identity fields (title, decidedFormat, hasVideo, imageCount) into the result", async () => {
      const repository = buildFakeRepository([], {}, [
        assetRow({
          id: "pkg-1",
          title: "Rumah Minimalis BSD",
          decidedFormat: "VIDEO_AND_IMAGES",
          hasVideo: true,
          imageCount: 2,
        }),
      ]);
      const service = new CreativeMemoryService(repository);
      const result = await service.getAssetPerformance(TENANT);
      expect(result.assets[0]).toMatchObject({
        packageId: "pkg-1",
        title: "Rumah Minimalis BSD",
        decidedFormat: "VIDEO_AND_IMAGES",
        hasVideo: true,
        imageCount: 2,
      });
    });
  });
});

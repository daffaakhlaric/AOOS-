import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it, vi } from "vitest";

import { GetAssetStats } from "../../../src/application/use-cases/GetAssetStats.js";
import { ListAssets } from "../../../src/application/use-cases/ListAssets.js";
import { AssetBuilder } from "../../../src/builders/AssetBuilder.js";
import type { AssetListFilter, IAssetRepository } from "../../../src/contracts/IAssetRepository.js";
import { AssetStatus } from "../../../src/domain/value-objects/AssetStatus.js";
import { AssetType } from "../../../src/domain/value-objects/AssetType.js";
import { AssetRepository } from "../../../src/infrastructure/supabase/AssetRepository.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

/** Captures the exact `AssetListFilter` the use case builds, so defaulting behavior is asserted directly. */
function spyRepository(): { repo: IAssetRepository; calls: AssetListFilter[] } {
  const calls: AssetListFilter[] = [];
  const repo = {
    listAssets: vi.fn(async (filter: AssetListFilter) => {
      calls.push(filter);
      return { ok: true as const, value: { assets: [], total: 0, page: 1, limit: 48 } };
    }),
    getStats: vi.fn(),
  } as unknown as IAssetRepository;
  return { repo, calls };
}

describe("ListAssets", () => {
  it("defaults to page 1, limit 48 and newest-first when the caller omits them", async () => {
    const { repo, calls } = spyRepository();
    await new ListAssets(repo).execute({ tenantId: "dss-motor" });
    expect(calls[0]).toEqual({ tenantId: "dss-motor", page: 1, limit: 48, sort: "newest" });
  });

  it("forwards every provided filter without inventing keys for the omitted ones", async () => {
    const { repo, calls } = spyRepository();
    await new ListAssets(repo).execute({
      tenantId: "dss-motor",
      type: AssetType.AI_VIDEO,
      status: AssetStatus.ACTIVE,
      branch: Branch.CINERE,
      unitId: "xpander-2019",
      search: "depan",
      model: "xpander",
      page: 2,
      limit: 12,
      sort: "oldest",
    });
    expect(calls[0]).toEqual({
      tenantId: "dss-motor",
      type: AssetType.AI_VIDEO,
      status: AssetStatus.ACTIVE,
      branch: Branch.CINERE,
      unitId: "xpander-2019",
      search: "depan",
      model: "xpander",
      page: 2,
      limit: 12,
      sort: "oldest",
    });
  });

  it("returns the repository's real page against a real AssetRepository", async () => {
    const client = createFakeSupabaseClient();
    const repository = new AssetRepository(client);
    for (let i = 0; i < 3; i += 1) {
      const asset = unwrap(new AssetBuilder().withStoragePath(`units/u/${i}.jpg`).build());
      await repository.insert(asset);
    }

    const page = unwrap(
      await new ListAssets(repository).execute({ tenantId: "dss-motor", limit: 2 }),
    );
    expect(page.assets).toHaveLength(2);
    expect(page.total).toBe(3);
  });

  it("propagates a repository error as an err Result", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("assets", "select failed");
    const error = unwrapErr(
      await new ListAssets(new AssetRepository(client)).execute({ tenantId: "dss-motor" }),
    );
    expect(error.message).toContain("AssetRepository.listAssets failed");
  });
});

describe("GetAssetStats", () => {
  it("delegates to the repository with the given tenantId", async () => {
    const getStats = vi.fn(async () => ({
      ok: true as const,
      value: {
        totalAssets: 0,
        byType: {} as never,
        byBranch: {},
        byStatus: {} as never,
        totalSizeBytes: 0,
      },
    }));
    const repo = { getStats } as unknown as IAssetRepository;
    await new GetAssetStats(repo).execute({ tenantId: "dss-motor" });
    expect(getStats).toHaveBeenCalledWith("dss-motor");
  });

  it("returns real aggregates against a real AssetRepository", async () => {
    const client = createFakeSupabaseClient();
    const repository = new AssetRepository(client);
    await repository.insert(unwrap(new AssetBuilder().withFileSize(1500).build()));

    const stats = unwrap(await new GetAssetStats(repository).execute({ tenantId: "dss-motor" }));
    expect(stats.totalAssets).toBe(1);
    expect(stats.totalSizeBytes).toBe(1500);
    expect(stats.byType[AssetType.UNIT_PHOTO]).toBe(1);
  });

  it("propagates a repository error as an err Result", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("assets", "boom");
    const error = unwrapErr(
      await new GetAssetStats(new AssetRepository(client)).execute({ tenantId: "dss-motor" }),
    );
    expect(error.message).toContain("AssetRepository.getStats failed");
  });
});

import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { AssetBuilder } from "../../../src/builders/AssetBuilder.js";
import { AssetStatus } from "../../../src/domain/value-objects/AssetStatus.js";
import { AssetType } from "../../../src/domain/value-objects/AssetType.js";
import { AssetRepository } from "../../../src/infrastructure/supabase/AssetRepository.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseClient, type FakeSupabaseClient } from "../../helpers/supabase.js";

/** Seeds `count` UNIT_PHOTO assets for `tenantId`, each with a distinct `storage_path`/`created_at`. */
async function seed(
  repo: AssetRepository,
  count: number,
  overrides: (index: number) => AssetBuilder,
): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    const asset = unwrap(
      overrides(index)
        .withStoragePath(`units/unit-${index}/photo-${index}.jpg`)
        .withCreatedAt(new Date(Date.UTC(2026, 0, index + 1)))
        .build(),
    );
    const inserted = await repo.insert(asset);
    expect(inserted.ok).toBe(true);
  }
}

function build(): { client: FakeSupabaseClient; repo: AssetRepository } {
  const client = createFakeSupabaseClient();
  return { client, repo: new AssetRepository(client) };
}

describe("AssetRepository.listAssets", () => {
  it("returns the requested page plus the UNPAGINATED total (Postgrest count), not the page length", async () => {
    const { repo } = build();
    await seed(repo, 5, () => new AssetBuilder().withTenantId("dss-motor"));

    const page1 = unwrap(await repo.listAssets({ tenantId: "dss-motor", page: 1, limit: 2 }));
    expect(page1.assets).toHaveLength(2);
    expect(page1.total).toBe(5);
    expect(page1.page).toBe(1);
    expect(page1.limit).toBe(2);

    const page3 = unwrap(await repo.listAssets({ tenantId: "dss-motor", page: 3, limit: 2 }));
    expect(page3.assets).toHaveLength(1);
    expect(page3.total).toBe(5);
  });

  it("is tenant-scoped — another tenant's assets are never returned or counted", async () => {
    const { repo } = build();
    await seed(repo, 2, () => new AssetBuilder().withTenantId("dss-motor"));
    await seed(repo, 3, (i) =>
      new AssetBuilder()
        .withTenantId("other-tenant")
        .withStoragePath(`other/unit-${i}/photo-${i}.jpg`),
    );

    const page = unwrap(await repo.listAssets({ tenantId: "dss-motor", page: 1, limit: 50 }));
    expect(page.total).toBe(2);
    expect(page.assets.every((a) => a.tenantId === "dss-motor")).toBe(true);
  });

  it("filters by type, status, branch and unitId (AND-combined)", async () => {
    const { repo } = build();
    await seed(repo, 1, () =>
      new AssetBuilder()
        .withType(AssetType.AI_VIDEO)
        .withStatus(AssetStatus.ACTIVE)
        .withBranch(Branch.CINERE)
        .withUnitId("xpander-2019"),
    );
    await seed(repo, 1, () =>
      new AssetBuilder()
        .withType(AssetType.AI_VIDEO)
        .withStatus(AssetStatus.ARCHIVED)
        .withBranch(Branch.CINERE)
        .withUnitId("xpander-2019")
        .withStoragePath("units/archived/photo.jpg"),
    );
    await seed(repo, 1, () =>
      new AssetBuilder()
        .withType(AssetType.AI_IMAGE)
        .withBranch(Branch.BINTARO)
        .withUnitId("brio-2021")
        .withStoragePath("units/brio/photo.jpg"),
    );

    const filtered = unwrap(
      await repo.listAssets({
        tenantId: "dss-motor",
        type: AssetType.AI_VIDEO,
        status: AssetStatus.ACTIVE,
        branch: Branch.CINERE,
        unitId: "xpander-2019",
        page: 1,
        limit: 50,
      }),
    );
    expect(filtered.total).toBe(1);
    expect(filtered.assets[0]?.type).toBe(AssetType.AI_VIDEO);
    expect(filtered.assets[0]?.status).toBe(AssetStatus.ACTIVE);
  });

  it("search matches file_name case-insensitively", async () => {
    const { repo } = build();
    await seed(repo, 1, () => new AssetBuilder().withFileName("Xpander-Cross-Depan.jpg"));
    await seed(repo, 1, () =>
      new AssetBuilder().withFileName("brio-rs.jpg").withStoragePath("units/b/brio.jpg"),
    );

    const found = unwrap(
      await repo.listAssets({ tenantId: "dss-motor", search: "xpander", page: 1, limit: 50 }),
    );
    expect(found.total).toBe(1);
    expect(found.assets[0]?.fileName).toBe("Xpander-Cross-Depan.jpg");
  });

  it("a blank/whitespace-only search is ignored rather than matching nothing", async () => {
    const { repo } = build();
    await seed(repo, 2, () => new AssetBuilder());

    const found = unwrap(
      await repo.listAssets({ tenantId: "dss-motor", search: "   ", page: 1, limit: 50 }),
    );
    expect(found.total).toBe(2);
  });

  it("sort=oldest reverses the default newest-first ordering", async () => {
    const { repo } = build();
    await seed(repo, 3, () => new AssetBuilder());

    const newest = unwrap(
      await repo.listAssets({ tenantId: "dss-motor", page: 1, limit: 1, sort: "newest" }),
    );
    const oldest = unwrap(
      await repo.listAssets({ tenantId: "dss-motor", page: 1, limit: 1, sort: "oldest" }),
    );
    expect(newest.assets[0]?.createdAt.getTime()).toBeGreaterThan(
      oldest.assets[0]?.createdAt.getTime() ?? 0,
    );
  });

  it("clamps a nonsense page/limit rather than issuing an unbounded query", async () => {
    const { repo } = build();
    await seed(repo, 3, () => new AssetBuilder());

    const clamped = unwrap(
      await repo.listAssets({ tenantId: "dss-motor", page: 0, limit: 100000 }),
    );
    expect(clamped.page).toBe(1);
    expect(clamped.limit).toBe(200);
  });

  it("surfaces a Postgrest error as a StorageError Result", async () => {
    const { client, repo } = build();
    client.forceErrorOnce("assets", "select failed");

    const error = unwrapErr(await repo.listAssets({ tenantId: "dss-motor", page: 1, limit: 10 }));
    expect(error.message).toContain("AssetRepository.listAssets failed");
  });
});

describe("AssetRepository.getStats", () => {
  it("aggregates totals per type, status and branch, with a zero entry for every real AssetType", async () => {
    const { repo } = build();
    await seed(repo, 1, () =>
      new AssetBuilder()
        .withType(AssetType.UNIT_PHOTO)
        .withBranch(Branch.CINERE)
        .withFileSize(1000),
    );
    await seed(repo, 1, () =>
      new AssetBuilder()
        .withType(AssetType.AI_VIDEO)
        .withBranch(Branch.CINERE)
        .withUnitId(undefined)
        .withStatus(AssetStatus.ARCHIVED)
        .withFileSize(2000)
        .withStoragePath("ai/video-1.mp4"),
    );
    await seed(repo, 1, () =>
      new AssetBuilder()
        .withType(AssetType.BRAND)
        .withBranch(undefined)
        .withUnitId(undefined)
        .withFileSize(500)
        .withStoragePath("brand/logo.png"),
    );

    const stats = unwrap(await repo.getStats("dss-motor"));
    expect(stats.totalAssets).toBe(3);
    expect(stats.byType[AssetType.UNIT_PHOTO]).toBe(1);
    expect(stats.byType[AssetType.AI_VIDEO]).toBe(1);
    expect(stats.byType[AssetType.BRAND]).toBe(1);
    // Never-used types are present as 0, so the UI never has to guess "missing vs zero".
    expect(stats.byType[AssetType.OVERLAY]).toBe(0);
    expect(stats.byType[AssetType.TESTIMONIAL]).toBe(0);
    expect(stats.byStatus[AssetStatus.ACTIVE]).toBe(2);
    expect(stats.byStatus[AssetStatus.ARCHIVED]).toBe(1);
    // A NULL branch is not bucketed under a fabricated "UMUM"/"unknown" key.
    expect(stats.byBranch).toEqual({ CINERE: 2 });
    expect(stats.totalSizeBytes).toBe(3500);
  });

  it("is tenant-scoped", async () => {
    const { repo } = build();
    await seed(repo, 2, () => new AssetBuilder().withTenantId("dss-motor"));
    await seed(repo, 4, (i) =>
      new AssetBuilder().withTenantId("other").withStoragePath(`other/${i}/p.jpg`),
    );

    const stats = unwrap(await repo.getStats("dss-motor"));
    expect(stats.totalAssets).toBe(2);
  });

  it("returns all-zero stats (never an error) for a tenant with no assets", async () => {
    const { repo } = build();
    const stats = unwrap(await repo.getStats("empty-tenant"));
    expect(stats.totalAssets).toBe(0);
    expect(stats.totalSizeBytes).toBe(0);
    expect(stats.byBranch).toEqual({});
  });

  it("surfaces a Postgrest error as a StorageError Result", async () => {
    const { client, repo } = build();
    client.forceErrorOnce("assets", "boom");

    const error = unwrapErr(await repo.getStats("dss-motor"));
    expect(error.message).toContain("AssetRepository.getStats failed");
  });
});

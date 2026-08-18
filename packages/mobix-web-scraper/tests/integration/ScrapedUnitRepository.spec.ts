import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { ScrapedUnitMapper } from "../../src/infrastructure/mappers/ScrapedUnitMapper.js";
import { ScrapedUnitRepository } from "../../src/infrastructure/supabase/ScrapedUnitRepository.js";
import { createFakeSupabaseClient, type FakeSupabaseClient } from "../helpers/supabase.js";
import { makeUnit } from "../helpers/units.js";

const TENANT = "dss-motor";

function build(): { client: FakeSupabaseClient; repo: ScrapedUnitRepository } {
  const client = createFakeSupabaseClient();
  return { client, repo: new ScrapedUnitRepository(client) };
}

function unwrap<T, E extends { message: string }>(result: {
  ok: boolean;
  value?: T;
  error?: E;
}): T {
  if (!result.ok) {
    throw new Error(`Expected ok Result, got error: ${result.error?.message ?? "unknown"}`);
  }
  return result.value as T;
}

function unwrapErr<E extends { message: string }>(result: { ok: boolean; error?: E }): E {
  if (result.ok) {
    throw new Error("Expected error Result, got ok");
  }
  return result.error as E;
}

describe("ScrapedUnitRepository.upsertMany", () => {
  it("inserts every unit in the batch and reports the count", async () => {
    const { client, repo } = build();
    const count = unwrap(
      await repo.upsertMany([makeUnit({ slug: "a" }), makeUnit({ slug: "b" })], TENANT),
    );
    expect(count).toBe(2);
    expect(client.rows("scraped_units")).toHaveLength(2);
  });

  it("is idempotent — re-upserting the same identity_key updates in place instead of duplicating", async () => {
    const { client, repo } = build();
    await repo.upsertMany([makeUnit({ slug: "brio-rs-2021", priceIdr: 145_000_000 })], TENANT);
    await repo.upsertMany([makeUnit({ slug: "brio-rs-2021", priceIdr: 139_000_000 })], TENANT);

    const rows = client.rows("scraped_units");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.["price_idr"]).toBe(139_000_000);
  });

  it("scopes the conflict target by tenant — the same slug for two tenants is two rows", async () => {
    const { client, repo } = build();
    await repo.upsertMany([makeUnit({ slug: "shared" })], "dss-motor");
    await repo.upsertMany([makeUnit({ slug: "shared" })], "other-tenant");
    expect(client.rows("scraped_units")).toHaveLength(2);
  });

  it("short-circuits on an empty batch without touching the client", async () => {
    const { client, repo } = build();
    const count = unwrap(await repo.upsertMany([], TENANT));
    expect(count).toBe(0);
    expect(client.rows("scraped_units")).toHaveLength(0);
  });

  it("surfaces a Postgrest error as an err(ScrapeError)", async () => {
    const { client, repo } = build();
    client.forceErrorOnce("scraped_units", "duplicate key");
    const error = unwrapErr(await repo.upsertMany([makeUnit()], TENANT));
    expect(error.message).toContain("ScrapedUnitRepository.upsertMany failed");
  });
});

describe("ScrapedUnitRepository.findByIdentityKey", () => {
  it("round-trips a unit through the mapper with every field intact", async () => {
    const { repo } = build();
    const original = makeUnit({
      slug: "xpander-cross-2019",
      brand: "Mitsubishi",
      model: "Xpander Cross",
      year: 2019,
      transmission: "AT",
      color: "Silver",
      kilometer: 45_000,
      priceIdr: 195_000_000,
      branch: Branch.CINERE,
      photos: ["https://cdn.mobixbydss.id/x/1.jpg", "https://cdn.mobixbydss.id/x/2.jpg"],
      available: true,
    });
    await repo.upsertMany([original], TENANT);

    const found = unwrap(await repo.findByIdentityKey("xpander-cross-2019", TENANT));
    expect(found).toBeDefined();
    expect(found?.brand).toBe("Mitsubishi");
    expect(found?.model).toBe("Xpander Cross");
    expect(found?.year).toBe(2019);
    expect(found?.transmission).toBe("AT");
    expect(found?.color).toBe("Silver");
    expect(found?.kilometer.km).toBe(45_000);
    expect(found?.price.idr).toBe(195_000_000);
    expect(found?.branch).toBe(Branch.CINERE);
    expect(found?.photos).toHaveLength(2);
    expect(found?.available).toBe(true);
    expect(found?.identityKey).toBe("xpander-cross-2019");
  });

  it("returns undefined for an unknown key", async () => {
    const { repo } = build();
    expect(unwrap(await repo.findByIdentityKey("nope", TENANT))).toBeUndefined();
  });

  it("never returns another tenant's unit", async () => {
    const { repo } = build();
    await repo.upsertMany([makeUnit({ slug: "secret" })], "other-tenant");
    expect(unwrap(await repo.findByIdentityKey("secret", TENANT))).toBeUndefined();
  });

  it("surfaces a Postgrest error", async () => {
    const { client, repo } = build();
    client.forceErrorOnce("scraped_units", "boom");
    const error = unwrapErr(await repo.findByIdentityKey("a", TENANT));
    expect(error.message).toContain("ScrapedUnitRepository.findByIdentityKey failed");
  });

  it("reports a row the mapper rejects as a mapping error rather than crashing", async () => {
    const { client, repo } = build();
    const row = ScrapedUnitMapper.toRow(makeUnit({ slug: "bad" }), TENANT);
    client.seed("scraped_units", [{ ...row, branch: "PONDOK_BAMBU" }]);
    const error = unwrapErr(await repo.findByIdentityKey("bad", TENANT));
    expect(error.message).toContain("row mapping failed");
    expect(error.message).toContain("unknown branch");
  });
});

describe("ScrapedUnitRepository.list", () => {
  async function seedStock(repo: ScrapedUnitRepository): Promise<void> {
    await repo.upsertMany(
      [
        makeUnit({ slug: "a", model: "Xpander Cross", branch: Branch.CINERE, available: true }),
        makeUnit({ slug: "b", model: "Brio RS", branch: Branch.BINTARO, available: true }),
        makeUnit({ slug: "c", model: "Brio Satya", branch: Branch.BINTARO, available: false }),
      ],
      TENANT,
    );
  }

  it("returns the page plus the unpaginated total", async () => {
    const { repo } = build();
    await seedStock(repo);
    const page = unwrap(await repo.list({ tenantId: TENANT, page: 1, limit: 2 }));
    expect(page.units).toHaveLength(2);
    expect(page.total).toBe(3);
    expect(page.page).toBe(1);
    expect(page.limit).toBe(2);
  });

  it("filters by branch", async () => {
    const { repo } = build();
    await seedStock(repo);
    const page = unwrap(
      await repo.list({ tenantId: TENANT, branch: Branch.BINTARO, page: 1, limit: 50 }),
    );
    expect(page.total).toBe(2);
  });

  it("filters by availability", async () => {
    const { repo } = build();
    await seedStock(repo);
    const page = unwrap(
      await repo.list({ tenantId: TENANT, available: false, page: 1, limit: 50 }),
    );
    expect(page.total).toBe(1);
    expect(page.units[0]?.identityKey).toBe("c");
  });

  it("searches model case-insensitively", async () => {
    const { repo } = build();
    await seedStock(repo);
    const page = unwrap(await repo.list({ tenantId: TENANT, search: "brio", page: 1, limit: 50 }));
    expect(page.total).toBe(2);
  });

  it("ignores a whitespace-only search", async () => {
    const { repo } = build();
    await seedStock(repo);
    const page = unwrap(await repo.list({ tenantId: TENANT, search: "  ", page: 1, limit: 50 }));
    expect(page.total).toBe(3);
  });

  it("is tenant-scoped", async () => {
    const { repo } = build();
    await seedStock(repo);
    await repo.upsertMany([makeUnit({ slug: "z" })], "other-tenant");
    const page = unwrap(await repo.list({ tenantId: TENANT, page: 1, limit: 50 }));
    expect(page.total).toBe(3);
  });

  it("clamps a nonsense page/limit", async () => {
    const { repo } = build();
    await seedStock(repo);
    const page = unwrap(await repo.list({ tenantId: TENANT, page: -5, limit: 99_999 }));
    expect(page.page).toBe(1);
    expect(page.limit).toBe(200);
  });

  it("surfaces a Postgrest error", async () => {
    const { client, repo } = build();
    client.forceErrorOnce("scraped_units", "boom");
    const error = unwrapErr(await repo.list({ tenantId: TENANT, page: 1, limit: 10 }));
    expect(error.message).toContain("ScrapedUnitRepository.list failed");
  });
});

describe("ScrapedUnitRepository.getStats", () => {
  it("aggregates unit/photo/branch counts and the latest scraped_at", async () => {
    const { repo } = build();
    await repo.upsertMany(
      [
        makeUnit({
          slug: "a",
          branch: Branch.CINERE,
          photos: ["1.jpg", "2.jpg"].map((p) => `https://cdn.mobixbydss.id/${p}`),
          available: true,
          scrapedAt: new Date("2026-08-10T00:00:00.000Z"),
        }),
        makeUnit({
          slug: "b",
          branch: Branch.CINERE,
          photos: ["https://cdn.mobixbydss.id/3.jpg"],
          available: false,
          scrapedAt: new Date("2026-08-14T07:32:00.000Z"),
        }),
        makeUnit({
          slug: "c",
          branch: Branch.BANDUNG,
          photos: [],
          available: true,
          scrapedAt: new Date("2026-08-12T00:00:00.000Z"),
        }),
      ],
      TENANT,
    );

    const stats = unwrap(await repo.getStats(TENANT));
    expect(stats.totalUnits).toBe(3);
    expect(stats.availableUnits).toBe(2);
    expect(stats.totalPhotos).toBe(3);
    expect(stats.byBranch).toEqual({ CINERE: 2, BANDUNG: 1 });
    expect(stats.lastScrapedAt).toBe("2026-08-14T07:32:00.000Z");
  });

  it("returns zeros and NO lastScrapedAt for a tenant that has never scraped (never a fabricated date)", async () => {
    const { repo } = build();
    const stats = unwrap(await repo.getStats("fresh-tenant"));
    expect(stats.totalUnits).toBe(0);
    expect(stats.totalPhotos).toBe(0);
    expect(stats.byBranch).toEqual({});
    expect(stats.lastScrapedAt).toBeUndefined();
  });

  it("surfaces a Postgrest error", async () => {
    const { client, repo } = build();
    client.forceErrorOnce("scraped_units", "boom");
    const error = unwrapErr(await repo.getStats(TENANT));
    expect(error.message).toContain("ScrapedUnitRepository.getStats failed");
  });
});

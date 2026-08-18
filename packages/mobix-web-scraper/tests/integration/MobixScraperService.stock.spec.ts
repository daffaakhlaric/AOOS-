import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it, vi } from "vitest";

import { MobixScraperService } from "../../src/application/services/MobixScraperService.js";
import { DetectInventoryChanges } from "../../src/application/use-cases/DetectInventoryChanges.js";
import type { ScrapeInventory } from "../../src/application/use-cases/ScrapeInventory.js";
import type { ScrapePromos } from "../../src/application/use-cases/ScrapePromos.js";
import { MobixScraperEvents } from "../../src/domain/events/MobixScraperEvents.js";
import { ScrapedUnitRepository } from "../../src/infrastructure/supabase/ScrapedUnitRepository.js";
import { createFakePublisher } from "../helpers/publisher.js";
import { createFakeSupabaseClient, type FakeSupabaseClient } from "../helpers/supabase.js";
import { makeUnit } from "../helpers/units.js";

const TENANT = "dss-motor";
const clock = () => new Date("2026-08-14T07:32:00.000Z");

interface Harness {
  readonly service: MobixScraperService;
  readonly client: FakeSupabaseClient;
  readonly repo: ScrapedUnitRepository;
}

function build(withRepository = true): Harness {
  const client = createFakeSupabaseClient();
  const repo = new ScrapedUnitRepository(client);
  const scrapeInventory = { execute: vi.fn() } as unknown as ScrapeInventory;
  const scrapePromos = { execute: vi.fn() } as unknown as ScrapePromos;
  const detect = new DetectInventoryChanges(new MobixScraperEvents(createFakePublisher()), clock);
  const service = new MobixScraperService(
    scrapeInventory,
    scrapePromos,
    detect,
    undefined,
    undefined,
    withRepository ? repo : undefined,
    TENANT,
  );
  return { service, client, repo };
}

describe("MobixScraperService — persisted stock reads", () => {
  it("getStockList reads the DURABLE scraped_units table, not the in-memory lastSession", async () => {
    const { service, repo } = build();
    await repo.upsertMany([makeUnit({ slug: "a" }), makeUnit({ slug: "b" })], TENANT);

    // Deliberately never called `scrapeInventoryUnits()` — `lastScrapedSession` is undefined, yet
    // real stock still comes back. That's the whole point of the new persistence layer.
    expect(service.lastScrapedSession).toBeUndefined();
    const result = await service.getStockList();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.total).toBe(2);
    }
  });

  it("getStockList defaults to page 1 / limit 50", async () => {
    const { service, repo } = build();
    await repo.upsertMany([makeUnit({ slug: "a" })], TENANT);
    const result = await service.getStockList();
    expect(result.ok && result.value.page).toBe(1);
    expect(result.ok && result.value.limit).toBe(50);
  });

  it("getStockList forwards branch/available/search filters", async () => {
    const { service, repo } = build();
    await repo.upsertMany(
      [
        makeUnit({ slug: "a", model: "Xpander Cross", branch: Branch.CINERE, available: true }),
        makeUnit({ slug: "b", model: "Brio RS", branch: Branch.BINTARO, available: false }),
      ],
      TENANT,
    );

    const cinere = await service.getStockList({ branch: Branch.CINERE });
    expect(cinere.ok && cinere.value.total).toBe(1);

    const unavailable = await service.getStockList({ available: false });
    expect(unavailable.ok && unavailable.value.total).toBe(1);
  });

  it("searchByModel is getStockList with the search filter applied", async () => {
    const { service, repo } = build();
    await repo.upsertMany(
      [makeUnit({ slug: "a", model: "Xpander Cross" }), makeUnit({ slug: "b", model: "Brio RS" })],
      TENANT,
    );

    const result = await service.searchByModel("xpander");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.total).toBe(1);
      expect(result.value.units[0]?.model).toBe("Xpander Cross");
    }
  });

  it("getUnit returns undefined (ok, not err) for a never-scraped unit", async () => {
    const { service } = build();
    const result = await service.getUnit("nope");
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toBeUndefined();
  });

  it("getUnitPhotos returns the unit's real source photo URLs", async () => {
    const { service, repo } = build();
    await repo.upsertMany(
      [
        makeUnit({
          slug: "a",
          photos: ["https://cdn.mobixbydss.id/1.jpg", "https://cdn.mobixbydss.id/2.jpg"],
        }),
      ],
      TENANT,
    );

    const result = await service.getUnitPhotos("a");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([
        "https://cdn.mobixbydss.id/1.jpg",
        "https://cdn.mobixbydss.id/2.jpg",
      ]);
    }
  });

  it("getUnitPhotos errs for an unknown unit rather than returning [] (so callers can tell 'not scraped' from 'no photos')", async () => {
    const { service } = build();
    const result = await service.getUnitPhotos("nope");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("no scraped unit");
    }
  });

  it("getUnitPhotos returns an empty array for a unit that really has no photos", async () => {
    const { service, repo } = build();
    await repo.upsertMany([makeUnit({ slug: "a", photos: [] })], TENANT);
    const result = await service.getUnitPhotos("a");
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toEqual([]);
  });

  it("getStockStats aggregates the persisted stock", async () => {
    const { service, repo } = build();
    await repo.upsertMany(
      [
        makeUnit({ slug: "a", branch: Branch.CINERE, photos: ["https://cdn.test/1.jpg"] }),
        makeUnit({ slug: "b", branch: Branch.CINERE, photos: [] }),
      ],
      TENANT,
    );

    const result = await service.getStockStats();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.totalUnits).toBe(2);
      expect(result.value.totalPhotos).toBe(1);
      expect(result.value.byBranch).toEqual({ CINERE: 2 });
    }
  });

  describe("without an IScrapedUnitRepository wired in", () => {
    it("getStockList errs with an explicit 'no persisted stock' message, never an empty list", async () => {
      const { service } = build(false);
      const result = await service.getStockList();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("was not composed with an IScrapedUnitRepository");
      }
    });

    it("getStockStats and getUnit err the same way", async () => {
      const { service } = build(false);
      expect((await service.getStockStats()).ok).toBe(false);
      expect((await service.getUnit("a")).ok).toBe(false);
    });
  });

  it("scrapeUnit errs when the factory composed no ScrapeUnit use case", async () => {
    const { service } = build();
    const result = await service.scrapeUnit("https://mobixbydss.id/unit/a");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("not composed with a ScrapeUnit");
    }
  });
});

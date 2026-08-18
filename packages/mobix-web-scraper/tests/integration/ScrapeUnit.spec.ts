import { Branch } from "@aos/meta-ads-connector";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { DownloadAndStorePhotos } from "../../src/application/use-cases/DownloadAndStorePhotos.js";
import { ScrapeInventory } from "../../src/application/use-cases/ScrapeInventory.js";
import { ScrapeUnit } from "../../src/application/use-cases/ScrapeUnit.js";
import { MobixScraperEvents } from "../../src/domain/events/MobixScraperEvents.js";
import { MobixInventoryScraper } from "../../src/infrastructure/scrapers/MobixInventoryScraper.js";
import { MobixUnitDetailFetcher } from "../../src/infrastructure/scrapers/MobixUnitDetailFetcher.js";
import { ScrapedUnitRepository } from "../../src/infrastructure/supabase/ScrapedUnitRepository.js";
import {
  API_ORIGIN,
  LISTING_API_URL,
  LISTING_PAGE_URL,
  detailHandler,
  listingHandler,
  photoHandler,
  REAL_DETAIL_PHOTO_URLS,
  REAL_ITEM_XPANDER_CROSS,
  REAL_ITEM_XPANDER_GLS,
} from "../helpers/mobixApi.js";
import { mswServer } from "../helpers/msw.js";
import { createFakePublisher } from "../helpers/publisher.js";
import { createFakeSupabaseClient } from "../helpers/supabase.js";
import { asUploadAsset, createFakeUploadAsset } from "../helpers/uploadAsset.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const TENANT = "dss-motor";
const clock = () => new Date("2026-08-17T13:08:24.000Z");

const GLS_URL = `${API_ORIGIN}/produk/${REAL_ITEM_XPANDER_GLS.slug}`;

/** Serves the real listing API plus the real detail + photo endpoints. */
function serveAll(items: ReadonlyArray<Record<string, unknown>>) {
  const listing = listingHandler([items]);
  const detail = detailHandler();
  mswServer.use(listing.handler, detail.handler, photoHandler());
  return { detail };
}

function buildScrapeInventory(): ScrapeInventory {
  const events = new MobixScraperEvents(createFakePublisher());
  const scraper = new MobixInventoryScraper({ listingUrl: LISTING_PAGE_URL, clock });
  return new ScrapeInventory(scraper, events, clock);
}

function buildPhotos(upload: ReturnType<typeof createFakeUploadAsset>): DownloadAndStorePhotos {
  return new DownloadAndStorePhotos(
    asUploadAsset(upload),
    new MobixScraperEvents(createFakePublisher()),
    TENANT,
    clock,
    fetch,
    undefined,
    new MobixUnitDetailFetcher({ listingUrl: LISTING_PAGE_URL }),
  );
}

describe("ScrapeUnit", () => {
  it("returns the single unit matching the URL's slug from the real listing", async () => {
    serveAll([REAL_ITEM_XPANDER_GLS, REAL_ITEM_XPANDER_CROSS]);
    const useCase = new ScrapeUnit(buildScrapeInventory());

    const result = await useCase.execute(GLS_URL);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.unit.identityKey).toBe(REAL_ITEM_XPANDER_GLS.slug);
      expect(result.value.unit.branch).toBe(Branch.BINTARO);
      expect(result.value.unit.price.idr).toBe(180_000_000);
      expect(result.value.unit.model).toBe("Xpander GLS MT");
    }
  });

  it("fetches the FULL gallery from the detail endpoint, not just the listing thumbnail", async () => {
    const { detail } = serveAll([REAL_ITEM_XPANDER_GLS]);
    const upload = createFakeUploadAsset();
    const useCase = new ScrapeUnit(buildScrapeInventory(), buildPhotos(upload));

    const result = await useCase.execute(GLS_URL, "corr-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // All 3 real gallery photos were uploaded — not the 1 thumbnail the listing carried.
    expect(result.value.photoResult?.succeeded).toHaveLength(3);
    expect(result.value.photoResult?.resolvedPhotos).toEqual(REAL_DETAIL_PHOTO_URLS);
    expect(upload.calls).toHaveLength(3);
    expect(upload.calls[0]?.unitId).toBe(REAL_ITEM_XPANDER_GLS.slug);
    expect(detail.requestedSlugs).toEqual([REAL_ITEM_XPANDER_GLS.slug]);
  });

  it("carries the full gallery onto the returned unit, so what is persisted matches what was uploaded", async () => {
    serveAll([REAL_ITEM_XPANDER_GLS]);
    const upload = createFakeUploadAsset();
    const client = createFakeSupabaseClient();
    const useCase = new ScrapeUnit(
      buildScrapeInventory(),
      buildPhotos(upload),
      new ScrapedUnitRepository(client),
      TENANT,
    );

    const result = await useCase.execute(GLS_URL);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.unit.photos).toEqual(REAL_DETAIL_PHOTO_URLS);
    const row = client.rows("scraped_units")[0] as { photos?: readonly string[] } | undefined;
    expect(row?.photos).toEqual(REAL_DETAIL_PHOTO_URLS);
  });

  it("re-ingests the unit's photos ALWAYS (unlike RunFullScrape, which only does so for new units)", async () => {
    serveAll([REAL_ITEM_XPANDER_GLS]);
    const upload = createFakeUploadAsset();
    const useCase = new ScrapeUnit(buildScrapeInventory(), buildPhotos(upload));

    await useCase.execute(GLS_URL);
    await useCase.execute(GLS_URL);

    // Two explicit re-scrapes ⇒ both ingested, with no "already known" suppression.
    expect(upload.calls).toHaveLength(6);
  });

  it("persists the re-scraped unit to scraped_units when a repository is wired in", async () => {
    serveAll([REAL_ITEM_XPANDER_GLS]);
    const client = createFakeSupabaseClient();
    const useCase = new ScrapeUnit(
      buildScrapeInventory(),
      undefined,
      new ScrapedUnitRepository(client),
      TENANT,
    );

    const result = await useCase.execute(GLS_URL);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.persisted).toBe(true);
    expect(client.rows("scraped_units")).toHaveLength(1);
  });

  it("reports persisted:false (rather than failing the whole re-scrape) when the DB write fails", async () => {
    serveAll([REAL_ITEM_XPANDER_GLS]);
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("scraped_units", "db down");
    const useCase = new ScrapeUnit(
      buildScrapeInventory(),
      undefined,
      new ScrapedUnitRepository(client),
      TENANT,
    );

    const result = await useCase.execute(GLS_URL);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.persisted).toBe(false);
      expect(result.value.unit.identityKey).toBe(REAL_ITEM_XPANDER_GLS.slug);
    }
  });

  it("errors with an honest 'sold or delisted' message when the slug is not in the current listing", async () => {
    serveAll([REAL_ITEM_XPANDER_GLS]);
    const useCase = new ScrapeUnit(buildScrapeInventory());

    const result = await useCase.execute(`${API_ORIGIN}/produk/gone-forever`);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("gone-forever");
      expect(result.error.message).toContain("sold or delisted");
    }
  });

  it("rejects a non-absolute / malformed unit URL before making any request", async () => {
    const useCase = new ScrapeUnit(buildScrapeInventory());

    const result = await useCase.execute("not-a-url");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("invalid unit URL");
  });

  it("rejects a URL with no slug segment", async () => {
    const useCase = new ScrapeUnit(buildScrapeInventory());

    const result = await useCase.execute(`${API_ORIGIN}/`);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("no slug segment");
  });

  it("propagates a listing-scrape failure", async () => {
    mswServer.use(http.post(LISTING_API_URL, () => new HttpResponse(null, { status: 503 })));
    const useCase = new ScrapeUnit(buildScrapeInventory());

    const result = await useCase.execute(GLS_URL);

    expect(result.ok).toBe(false);
  });
});

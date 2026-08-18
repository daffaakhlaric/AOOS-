import { Branch } from "@aos/meta-ads-connector";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { DetectInventoryChanges } from "../../src/application/use-cases/DetectInventoryChanges.js";
import { DownloadAndStorePhotos } from "../../src/application/use-cases/DownloadAndStorePhotos.js";
import {
  RunFullScrape,
  type ScrapeProgressEvent,
} from "../../src/application/use-cases/RunFullScrape.js";
import { ScrapeInventory } from "../../src/application/use-cases/ScrapeInventory.js";
import { ScrapedUnit } from "../../src/domain/entities/ScrapedUnit.js";
import { ScrapeSession } from "../../src/domain/entities/ScrapeSession.js";
import { MobixScraperEvents } from "../../src/domain/events/MobixScraperEvents.js";
import { ScrapedKilometer } from "../../src/domain/value-objects/ScrapedKilometer.js";
import { ScrapedPrice } from "../../src/domain/value-objects/ScrapedPrice.js";
import { ScrapeTimestamp } from "../../src/domain/value-objects/ScrapeTimestamp.js";
import { UnitUrl } from "../../src/domain/value-objects/UnitUrl.js";
import { absolutePhotoUrl } from "../../src/infrastructure/api/MobixUnitMapper.js";
import { MobixInventoryScraper } from "../../src/infrastructure/scrapers/MobixInventoryScraper.js";
import { MobixUnitDetailFetcher } from "../../src/infrastructure/scrapers/MobixUnitDetailFetcher.js";
import {
  API_ORIGIN,
  DETAIL_API_URL,
  LISTING_API_URL,
  LISTING_PAGE_URL,
  PHOTO_CDN_ORIGIN,
  detailHandler,
  listingHandler,
  photoHandler,
  REAL_DETAIL_PHOTO_URLS,
  REAL_DETAIL_RESPONSE,
  REAL_ITEM_XPANDER_CROSS,
  REAL_ITEM_XPANDER_GLS,
} from "../helpers/mobixApi.js";
import { mswServer } from "../helpers/msw.js";
import { createFakePublisher } from "../helpers/publisher.js";
import { asUploadAsset, createFakeUploadAsset } from "../helpers/uploadAsset.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const TENANT_ID = "dss-motor";
const clock = () => new Date("2026-08-17T13:03:09.000Z");

/** A previous session containing the given slugs, so `DetectInventoryChanges` sees them as known. */
function session(sessionId: string, slugs: string[]): ScrapeSession {
  const units = slugs.map((slug) => {
    const url = UnitUrl.create(`${API_ORIGIN}/produk/${slug}`);
    const km = ScrapedKilometer.create(1000);
    const price = ScrapedPrice.create(150_000_000);
    if (!url.ok || !km.ok || !price.ok) throw new Error("fixture setup failed");
    const result = ScrapedUnit.create({
      url: url.value,
      model: slug,
      brand: "Mitsubishi",
      year: 2019,
      transmission: "AT",
      color: "Putih",
      kilometer: km.value,
      price: price.value,
      branch: Branch.BINTARO,
      photos: [],
      available: true,
      scrapedAt: ScrapeTimestamp.now(clock),
    });
    if (!result.ok) throw new Error("fixture setup failed");
    return result.value;
  });
  const result = ScrapeSession.create({
    sessionId,
    units,
    startedAt: clock(),
    completedAt: clock(),
    sourceUrl: LISTING_API_URL,
  });
  if (!result.ok) throw new Error("fixture setup failed");
  return result.value;
}

function makeParts(
  uploadAssetFake?: ReturnType<typeof createFakeUploadAsset>,
  options: { readonly withDetailFetcher?: boolean } = {},
) {
  const publisher = createFakePublisher();
  const events = new MobixScraperEvents(publisher);
  const inventoryScraper = new MobixInventoryScraper({ listingUrl: LISTING_PAGE_URL, clock });
  const scrapeInventory = new ScrapeInventory(inventoryScraper, events, clock);
  const detectInventoryChanges = new DetectInventoryChanges(events, clock);
  const detailFetcher =
    options.withDetailFetcher === false
      ? undefined
      : new MobixUnitDetailFetcher({ listingUrl: LISTING_PAGE_URL });
  const downloadAndStorePhotos = uploadAssetFake
    ? new DownloadAndStorePhotos(
        asUploadAsset(uploadAssetFake),
        events,
        TENANT_ID,
        clock,
        fetch,
        undefined,
        detailFetcher,
      )
    : undefined;
  const runFullScrape = new RunFullScrape(
    scrapeInventory,
    detectInventoryChanges,
    downloadAndStorePhotos,
  );
  return { runFullScrape, publisher };
}

describe("RunFullScrape (integration, MSW-mocked mobixbydss.id JSON API + mocked UploadAsset)", () => {
  it("cold start: scrapes, diffs, and ingests each new unit's FULL gallery from the detail endpoint", async () => {
    const listing = listingHandler([[REAL_ITEM_XPANDER_GLS]]);
    const detail = detailHandler();
    mswServer.use(listing.handler, detail.handler, photoHandler());
    const fakeUploadAsset = createFakeUploadAsset();
    const { runFullScrape } = makeParts(fakeUploadAsset);

    const result = await runFullScrape.execute(undefined);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.session.unitCount).toBe(1);
    expect(result.value.diff.newUnits).toHaveLength(1);
    // The listing only carried ONE thumbnail — the detail endpoint supplied all 3 gallery photos.
    expect(result.value.session.units[0]?.photos).toHaveLength(1);
    expect(result.value.photoResults[0]?.resolvedPhotos).toEqual(REAL_DETAIL_PHOTO_URLS);
    expect(result.value.photoResults[0]?.succeeded).toHaveLength(3);
    expect(fakeUploadAsset.calls).toHaveLength(3);
    expect(detail.requestedSlugs).toEqual([REAL_ITEM_XPANDER_GLS.slug]);
  });

  it("fetches the detail gallery ONLY for newly-detected units, never for already-known ones", async () => {
    const listing = listingHandler([[REAL_ITEM_XPANDER_GLS, REAL_ITEM_XPANDER_CROSS]]);
    const detail = detailHandler();
    mswServer.use(listing.handler, detail.handler, photoHandler());
    const previous = session("s0", [REAL_ITEM_XPANDER_GLS.slug]);
    const fakeUploadAsset = createFakeUploadAsset();
    const { runFullScrape } = makeParts(fakeUploadAsset);

    const result = await runFullScrape.execute(previous);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.diff.newUnits.map((u) => u.identityKey)).toEqual([
      REAL_ITEM_XPANDER_CROSS.slug,
    ]);
    expect(result.value.diff.unchangedCount).toBe(1);
    expect(result.value.photoResults).toHaveLength(1);
    // The already-known GLS unit's detail endpoint was never called — the no-re-download rule holds.
    expect(detail.requestedSlugs).toEqual([REAL_ITEM_XPANDER_CROSS.slug]);
  });

  it("emits a branch_fallback progress event for the real PONDOK BAMBU unit", async () => {
    const listing = listingHandler([[REAL_ITEM_XPANDER_CROSS]]);
    mswServer.use(listing.handler);
    const { runFullScrape } = makeParts(undefined);
    const events: ScrapeProgressEvent[] = [];

    const result = await runFullScrape.execute(undefined, undefined, (event) => events.push(event));

    expect(result.ok).toBe(true);
    const fallback = events.find((event) => event.type === "branch_fallback");
    expect(fallback).toEqual({
      type: "branch_fallback",
      rawCabang: "PONDOK BAMBU",
      slug: REAL_ITEM_XPANDER_CROSS.slug,
      fallback: Branch.UMUM,
    });
  });

  it("skips photo ingestion entirely when no DownloadAndStorePhotos was wired", async () => {
    const listing = listingHandler([[REAL_ITEM_XPANDER_GLS]]);
    mswServer.use(listing.handler);
    const { runFullScrape } = makeParts(undefined);

    const result = await runFullScrape.execute(undefined);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.diff.newUnits).toHaveLength(1);
      expect(result.value.photoResults).toHaveLength(0);
    }
  });

  it("propagates a ScrapeInventory failure without attempting diff or photo ingestion", async () => {
    mswServer.use(http.post(LISTING_API_URL, () => new HttpResponse(null, { status: 503 })));
    const fakeUploadAsset = createFakeUploadAsset();
    const { runFullScrape, publisher } = makeParts(fakeUploadAsset);

    const result = await runFullScrape.execute(undefined);

    expect(result.ok).toBe(false);
    expect(fakeUploadAsset.calls).toHaveLength(0);
    expect(publisher.published.some((p) => p.type === "aaos.mobix-scraper.unit.new-detected")).toBe(
      false,
    );
  });

  it("a unit with one failing photo still completes the full scrape (partial-failure tolerant)", async () => {
    const listing = listingHandler([[REAL_ITEM_XPANDER_GLS]]);
    const detail = detailHandler();
    mswServer.use(
      listing.handler,
      detail.handler,
      http.get(
        `${PHOTO_CDN_ORIGIN}/unit-file-serve`,
        () => new HttpResponse(null, { status: 403 }),
      ),
    );
    const fakeUploadAsset = createFakeUploadAsset();
    const { runFullScrape } = makeParts(fakeUploadAsset);

    const result = await runFullScrape.execute(undefined);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.session.unitCount).toBe(1);
    expect(result.value.photoResults[0]?.failed).toHaveLength(3);
    expect(result.value.photoResults[0]?.succeeded).toHaveLength(0);
  });

  it("falls back to the listing thumbnail (and reports why) when the detail fetch fails", async () => {
    const listing = listingHandler([[REAL_ITEM_XPANDER_GLS]]);
    mswServer.use(
      listing.handler,
      http.post(DETAIL_API_URL, () => new HttpResponse(null, { status: 500 })),
      photoHandler(),
    );
    const fakeUploadAsset = createFakeUploadAsset();
    const { runFullScrape } = makeParts(fakeUploadAsset);

    const result = await runFullScrape.execute(undefined);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const batch = result.value.photoResults[0];
    expect(batch?.detailFetchFailed).toContain("500");
    // The thumbnail still got ingested — a detail failure must not mean zero photos for the unit.
    expect(batch?.resolvedPhotos).toEqual([absolutePhotoUrl(REAL_ITEM_XPANDER_GLS.thumbnail)]);
    expect(batch?.succeeded).toHaveLength(1);
  });

  it("keeps the listing thumbnail when the real detail response has an empty galeri", async () => {
    const listing = listingHandler([[REAL_ITEM_XPANDER_GLS]]);
    const detail = detailHandler({
      ...REAL_DETAIL_RESPONSE,
      data: { ...REAL_DETAIL_RESPONSE.data, galeri: [] },
    });
    mswServer.use(listing.handler, detail.handler, photoHandler());
    const fakeUploadAsset = createFakeUploadAsset();
    const { runFullScrape } = makeParts(fakeUploadAsset);

    const result = await runFullScrape.execute(undefined);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.photoResults[0]?.resolvedPhotos).toHaveLength(1);
    }
  });

  it("forwards a correlationId to every uploaded photo", async () => {
    const listing = listingHandler([[REAL_ITEM_XPANDER_GLS]]);
    const detail = detailHandler();
    mswServer.use(listing.handler, detail.handler, photoHandler());
    const fakeUploadAsset = createFakeUploadAsset();
    const { runFullScrape } = makeParts(fakeUploadAsset);

    await runFullScrape.execute(undefined, "batch-corr-1");

    expect(fakeUploadAsset.calls).toHaveLength(3);
    for (const call of fakeUploadAsset.calls) {
      expect(call.correlationId).toBe("batch-corr-1");
    }
  });

  it("ingests only the listing thumbnail when no detail fetcher is wired at all", async () => {
    const listing = listingHandler([[REAL_ITEM_XPANDER_GLS]]);
    mswServer.use(listing.handler, photoHandler());
    const fakeUploadAsset = createFakeUploadAsset();
    const { runFullScrape } = makeParts(fakeUploadAsset, { withDetailFetcher: false });

    const result = await runFullScrape.execute(undefined);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.photoResults[0]?.succeeded).toHaveLength(1);
  });
});

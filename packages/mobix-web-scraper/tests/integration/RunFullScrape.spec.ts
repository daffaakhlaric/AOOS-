import { Branch } from "@aos/meta-ads-connector";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { DetectInventoryChanges } from "../../src/application/use-cases/DetectInventoryChanges.js";
import { DownloadAndStorePhotos } from "../../src/application/use-cases/DownloadAndStorePhotos.js";
import { RunFullScrape } from "../../src/application/use-cases/RunFullScrape.js";
import { ScrapeInventory } from "../../src/application/use-cases/ScrapeInventory.js";
import { ScrapedUnit } from "../../src/domain/entities/ScrapedUnit.js";
import { ScrapeSession } from "../../src/domain/entities/ScrapeSession.js";
import { MobixScraperEvents } from "../../src/domain/events/MobixScraperEvents.js";
import { ScrapedKilometer } from "../../src/domain/value-objects/ScrapedKilometer.js";
import { ScrapedPrice } from "../../src/domain/value-objects/ScrapedPrice.js";
import { ScrapeTimestamp } from "../../src/domain/value-objects/ScrapeTimestamp.js";
import { UnitUrl } from "../../src/domain/value-objects/UnitUrl.js";
import { MobixInventoryScraper } from "../../src/infrastructure/scrapers/MobixInventoryScraper.js";
import { mswServer } from "../helpers/msw.js";
import { createFakePublisher } from "../helpers/publisher.js";
import { asUploadAsset, createFakeUploadAsset } from "../helpers/uploadAsset.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const LISTING_URL = "https://mobixbydss.id/unit";
const TENANT_ID = "dss-motor";
const clock = () => new Date("2026-08-07T00:00:00.000Z");
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

function cardHtml(slug: string, model: string, withPhoto: boolean): string {
  const img = withPhoto ? `<img src="https://mobixbydss.id/photos/${slug}.jpg" />` : "";
  return `<article class="unit-card" data-branch="BINTARO" data-available="true">
  <a class="unit-card__link" href="https://mobixbydss.id/unit/${slug}">
    ${img}
    <h3 class="unit-card__title">Mitsubishi ${model} 2019</h3>
    <span class="unit-card__price">Rp 195.000.000</span>
    <span class="unit-card__km">45.000 km</span>
    <span class="unit-card__transmission">AT</span>
    <span class="unit-card__color">Putih</span>
  </a>
</article>`;
}

function session(sessionId: string, slugs: string[]): ScrapeSession {
  const units = slugs.map((slug) => {
    const url = UnitUrl.create(`https://mobixbydss.id/unit/${slug}`);
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
    sourceUrl: LISTING_URL,
  });
  if (!result.ok) throw new Error("fixture setup failed");
  return result.value;
}

function makeParts(uploadAssetFake?: ReturnType<typeof createFakeUploadAsset>) {
  const publisher = createFakePublisher();
  const events = new MobixScraperEvents(publisher);
  const inventoryScraper = new MobixInventoryScraper({ listingUrl: LISTING_URL, clock });
  const scrapeInventory = new ScrapeInventory(inventoryScraper, events, clock);
  const detectInventoryChanges = new DetectInventoryChanges(events, clock);
  const downloadAndStorePhotos = uploadAssetFake
    ? new DownloadAndStorePhotos(asUploadAsset(uploadAssetFake), events, TENANT_ID, clock)
    : undefined;
  const runFullScrape = new RunFullScrape(
    scrapeInventory,
    detectInventoryChanges,
    downloadAndStorePhotos,
  );
  return { runFullScrape, publisher };
}

describe("RunFullScrape (integration, MSW-mocked mobixbydss.id + mocked UploadAsset)", () => {
  it("scrapes, diffs against undefined previous session (cold start), and uploads photos for every unit", async () => {
    mswServer.use(
      http.get(LISTING_URL, () =>
        HttpResponse.html(`<html><body>${cardHtml("xpander-1", "Xpander", true)}</body></html>`),
      ),
      http.get("https://mobixbydss.id/photos/xpander-1.jpg", () =>
        HttpResponse.arrayBuffer(JPEG_BYTES.buffer, { headers: { "content-type": "image/jpeg" } }),
      ),
    );
    const fakeUploadAsset = createFakeUploadAsset();
    const { runFullScrape } = makeParts(fakeUploadAsset);

    const result = await runFullScrape.execute(undefined);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.session.unitCount).toBe(1);
      expect(result.value.diff.newUnits).toHaveLength(1);
      expect(result.value.diff.soldUnits).toHaveLength(0);
      expect(result.value.photoResults).toHaveLength(1);
      expect(result.value.photoResults[0]?.succeeded).toHaveLength(1);
    }
    expect(fakeUploadAsset.calls).toHaveLength(1);
  });

  it("only downloads photos for newly-detected units, not units unchanged from the previous session", async () => {
    mswServer.use(
      http.get(LISTING_URL, () =>
        HttpResponse.html(
          `<html><body>${cardHtml("xpander-1", "Xpander", true)}${cardHtml("brio-1", "Brio", true)}</body></html>`,
        ),
      ),
      http.get("https://mobixbydss.id/photos/xpander-1.jpg", () =>
        HttpResponse.arrayBuffer(JPEG_BYTES.buffer, { headers: { "content-type": "image/jpeg" } }),
      ),
      http.get("https://mobixbydss.id/photos/brio-1.jpg", () =>
        HttpResponse.arrayBuffer(JPEG_BYTES.buffer, { headers: { "content-type": "image/jpeg" } }),
      ),
    );
    const previous = session("s0", ["xpander-1"]);
    const fakeUploadAsset = createFakeUploadAsset();
    const { runFullScrape } = makeParts(fakeUploadAsset);

    const result = await runFullScrape.execute(previous);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.diff.newUnits.map((u) => u.identityKey)).toEqual(["brio-1"]);
      expect(result.value.diff.unchangedCount).toBe(1);
      // Only the newly-detected unit's photo batch is present.
      expect(result.value.photoResults).toHaveLength(1);
      expect(result.value.photoResults[0]?.unitIdentityKey).toBe("brio-1");
    }
    expect(fakeUploadAsset.calls).toHaveLength(1);
  });

  it("skips photo ingestion entirely when no DownloadAndStorePhotos was wired (no asset-library dependency configured)", async () => {
    mswServer.use(
      http.get(LISTING_URL, () =>
        HttpResponse.html(`<html><body>${cardHtml("xpander-1", "Xpander", true)}</body></html>`),
      ),
    );
    const { runFullScrape } = makeParts(undefined);

    const result = await runFullScrape.execute(undefined);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.diff.newUnits).toHaveLength(1);
      expect(result.value.photoResults).toHaveLength(0);
    }
  });

  it("propagates a ScrapeInventory failure without attempting diff or photo ingestion", async () => {
    mswServer.use(http.get(LISTING_URL, () => new HttpResponse(null, { status: 503 })));
    const fakeUploadAsset = createFakeUploadAsset();
    const { runFullScrape, publisher } = makeParts(fakeUploadAsset);

    const result = await runFullScrape.execute(undefined);

    expect(result.ok).toBe(false);
    expect(fakeUploadAsset.calls).toHaveLength(0);
    expect(publisher.published.some((p) => p.type === "aaos.mobix-scraper.unit.new-detected")).toBe(
      false,
    );
  });

  it("a unit with a failing photo still completes the full scrape (partial-failure tolerant)", async () => {
    mswServer.use(
      http.get(LISTING_URL, () =>
        HttpResponse.html(`<html><body>${cardHtml("xpander-1", "Xpander", true)}</body></html>`),
      ),
      http.get(
        "https://mobixbydss.id/photos/xpander-1.jpg",
        () => new HttpResponse(null, { status: 403 }),
      ),
    );
    const fakeUploadAsset = createFakeUploadAsset();
    const { runFullScrape } = makeParts(fakeUploadAsset);

    const result = await runFullScrape.execute(undefined);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.session.unitCount).toBe(1);
      expect(result.value.photoResults[0]?.failed).toHaveLength(1);
      expect(result.value.photoResults[0]?.succeeded).toHaveLength(0);
    }
  });

  it("a unit with no photos still produces a photo batch with empty succeeded/failed when it is newly-detected", async () => {
    mswServer.use(
      http.get(LISTING_URL, () =>
        HttpResponse.html(`<html><body>${cardHtml("xpander-1", "Xpander", false)}</body></html>`),
      ),
    );
    const fakeUploadAsset = createFakeUploadAsset();
    const { runFullScrape } = makeParts(fakeUploadAsset);

    const result = await runFullScrape.execute(undefined);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.photoResults).toHaveLength(1);
      expect(result.value.photoResults[0]?.succeeded).toHaveLength(0);
      expect(result.value.photoResults[0]?.failed).toHaveLength(0);
    }
    expect(fakeUploadAsset.calls).toHaveLength(0);
  });

  it("forwards a correlationId to every unit's photo batch", async () => {
    mswServer.use(
      http.get(LISTING_URL, () =>
        HttpResponse.html(`<html><body>${cardHtml("xpander-1", "Xpander", true)}</body></html>`),
      ),
      http.get("https://mobixbydss.id/photos/xpander-1.jpg", () =>
        HttpResponse.arrayBuffer(JPEG_BYTES.buffer, { headers: { "content-type": "image/jpeg" } }),
      ),
    );
    const fakeUploadAsset = createFakeUploadAsset();
    const { runFullScrape } = makeParts(fakeUploadAsset);

    await runFullScrape.execute(undefined, "batch-corr-1");

    expect(fakeUploadAsset.calls[0]?.correlationId).toBe("batch-corr-1");
  });
});

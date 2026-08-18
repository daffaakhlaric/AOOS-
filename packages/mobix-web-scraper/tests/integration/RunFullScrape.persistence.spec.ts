import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { DetectInventoryChanges } from "../../src/application/use-cases/DetectInventoryChanges.js";
import { DownloadAndStorePhotos } from "../../src/application/use-cases/DownloadAndStorePhotos.js";
import {
  RunFullScrape,
  type ScrapeProgressEvent,
} from "../../src/application/use-cases/RunFullScrape.js";
import { ScrapeInventory } from "../../src/application/use-cases/ScrapeInventory.js";
import { MobixScraperEvents } from "../../src/domain/events/MobixScraperEvents.js";
import { MobixInventoryScraper } from "../../src/infrastructure/scrapers/MobixInventoryScraper.js";
import { MobixUnitDetailFetcher } from "../../src/infrastructure/scrapers/MobixUnitDetailFetcher.js";
import { ScrapedUnitRepository } from "../../src/infrastructure/supabase/ScrapedUnitRepository.js";
import {
  LISTING_PAGE_URL,
  detailHandler,
  listingHandler,
  photoHandler,
  REAL_DETAIL_PHOTO_URLS,
  REAL_ITEM_XPANDER_GLS,
} from "../helpers/mobixApi.js";
import { mswServer } from "../helpers/msw.js";
import { createFakePublisher } from "../helpers/publisher.js";
import { createFakeSupabaseClient, type FakeSupabaseClient } from "../helpers/supabase.js";
import { asUploadAsset, createFakeUploadAsset } from "../helpers/uploadAsset.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const TENANT = "dss-motor";
const clock = () => new Date("2026-08-17T13:03:09.000Z");

/** A real listing item under a different slug/price — used to build multi-unit listings. */
function itemWith(slug: string, harga = 145_000_000): Record<string, unknown> {
  return { ...REAL_ITEM_XPANDER_GLS, slug, harga };
}

function serve(slugs: readonly string[], harga = 145_000_000) {
  const listing = listingHandler([slugs.map((slug) => itemWith(slug, harga))]);
  const detail = detailHandler();
  mswServer.use(listing.handler, detail.handler, photoHandler());
  return { listing, detail };
}

interface Parts {
  readonly runFullScrape: RunFullScrape;
  readonly client: FakeSupabaseClient;
  readonly upload: ReturnType<typeof createFakeUploadAsset>;
}

function makeParts(options: { withRepository?: boolean; withPhotos?: boolean } = {}): Parts {
  const events = new MobixScraperEvents(createFakePublisher());
  const scrapeInventory = new ScrapeInventory(
    new MobixInventoryScraper({ listingUrl: LISTING_PAGE_URL, clock }),
    events,
    clock,
  );
  const client = createFakeSupabaseClient();
  const upload = createFakeUploadAsset();
  const photos =
    options.withPhotos === false
      ? undefined
      : new DownloadAndStorePhotos(
          asUploadAsset(upload),
          events,
          TENANT,
          clock,
          fetch,
          undefined,
          new MobixUnitDetailFetcher({ listingUrl: LISTING_PAGE_URL }),
        );
  const runFullScrape = new RunFullScrape(
    scrapeInventory,
    new DetectInventoryChanges(events, clock),
    photos,
    options.withRepository === false ? undefined : new ScrapedUnitRepository(client),
    TENANT,
  );
  return { runFullScrape, client, upload };
}

describe("RunFullScrape — scraped_units persistence (AAOS-SCRAPER-ASSET-LIBRARY)", () => {
  it("persists EVERY unit in the session, not just the newly-detected ones", async () => {
    serve(["brio-a", "brio-b"]);
    const { runFullScrape, client } = makeParts();

    // First run: both units are "new".
    const first = await runFullScrape.execute(undefined);
    expect(first.ok).toBe(true);
    expect(client.rows("scraped_units")).toHaveLength(2);

    // Second run diffed against the first: NO new units, so no photos are re-downloaded — but both
    // units are still re-persisted with their refreshed price. This is exactly what makes
    // "Scrape Semua Ulang" honest: listing metadata is always refreshed, photos are not re-ingested.
    mswServer.resetHandlers();
    const { detail } = serve(["brio-a", "brio-b"], 139_000_000);
    const second = await runFullScrape.execute(first.ok ? first.value.session : undefined);

    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.diff.newUnits).toHaveLength(0);
      expect(second.value.photoResults).toHaveLength(0);
      expect(second.value.persistedUnits).toBe(2);
    }
    // No new units ⇒ the detail endpoint was never called on the second run.
    expect(detail.requestedSlugs).toEqual([]);
    const rows = client.rows("scraped_units");
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row["price_idr"] === 139_000_000)).toBe(true);
  });

  it("persists the FULL downloaded gallery for new units, not the single listing thumbnail", async () => {
    serve(["brio-a"]);
    const { runFullScrape, client } = makeParts();

    const result = await runFullScrape.execute(undefined);

    expect(result.ok).toBe(true);
    const row = client.rows("scraped_units")[0] as { photos?: readonly string[] } | undefined;
    expect(row?.photos).toEqual(REAL_DETAIL_PHOTO_URLS);
  });

  it("leaves persistedUnits undefined when no repository was wired in", async () => {
    serve(["brio-a"]);
    const { runFullScrape } = makeParts({ withRepository: false });

    const result = await runFullScrape.execute(undefined);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.persistedUnits).toBeUndefined();
  });

  it("still succeeds (and reports persist_failed) when the DB write fails — a successful scrape is never discarded", async () => {
    serve(["brio-a"]);
    const { runFullScrape, client } = makeParts();
    client.forceErrorOnce("scraped_units", "connection refused");

    const events: ScrapeProgressEvent[] = [];
    const result = await runFullScrape.execute(undefined, "corr-1", (e) => events.push(e));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.session.unitCount).toBe(1);
      expect(result.value.persistedUnits).toBeUndefined();
    }
    const failure = events.find((e) => e.type === "persist_failed");
    expect(failure).toBeDefined();
    expect(failure?.type === "persist_failed" && failure.reason).toContain("connection refused");
  });
});

describe("RunFullScrape — progress events", () => {
  it("emits only REAL milestones, in pipeline order", async () => {
    serve(["brio-a", "brio-b"]);
    const { runFullScrape } = makeParts();
    const events: ScrapeProgressEvent[] = [];

    await runFullScrape.execute(undefined, "corr-1", (e) => events.push(e));

    expect(events.map((e) => e.type)).toEqual([
      "listing_parsed",
      "diff_computed",
      "unit_photos_done",
      "unit_photos_done",
      "units_persisted",
    ]);
  });

  it("listing_parsed carries the real parsed unit count", async () => {
    serve(["brio-a", "brio-b", "brio-c"]);
    const { runFullScrape } = makeParts();
    const events: ScrapeProgressEvent[] = [];

    await runFullScrape.execute(undefined, undefined, (e) => events.push(e));

    const parsed = events.find((e) => e.type === "listing_parsed");
    expect(parsed?.type === "listing_parsed" && parsed.totalUnits).toBe(3);
  });

  it("unit_photos_done carries real current/total and per-unit success counts", async () => {
    serve(["brio-a", "brio-b"]);
    const { runFullScrape } = makeParts();
    const events: ScrapeProgressEvent[] = [];

    await runFullScrape.execute(undefined, undefined, (e) => events.push(e));

    const done = events.filter((e) => e.type === "unit_photos_done");
    expect(done).toHaveLength(2);
    const first = done[0];
    if (first?.type === "unit_photos_done") {
      expect(first.current).toBe(1);
      expect(first.total).toBe(2);
      // 3 real gallery photos per unit, fetched from the detail endpoint.
      expect(first.succeeded).toBe(3);
      expect(first.failed).toBe(0);
      expect(first.model).toBe("Mitsubishi Xpander GLS MT 2022");
    }
  });

  it("emits no unit_photos_done events when photo ingestion isn't wired in", async () => {
    serve(["brio-a"]);
    const { runFullScrape } = makeParts({ withPhotos: false });
    const events: ScrapeProgressEvent[] = [];

    await runFullScrape.execute(undefined, undefined, (e) => events.push(e));

    expect(events.some((e) => e.type === "unit_photos_done")).toBe(false);
  });

  it("runs fine with no onProgress listener at all", async () => {
    serve(["brio-a"]);
    const { runFullScrape } = makeParts();

    const result = await runFullScrape.execute(undefined);

    expect(result.ok).toBe(true);
  });
});

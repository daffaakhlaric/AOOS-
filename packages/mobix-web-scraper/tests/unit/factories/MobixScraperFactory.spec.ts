import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { MobixScraperFactory } from "../../../src/factories/MobixScraperFactory.js";
import {
  detailHandler,
  listingHandler,
  listingResponse,
  photoHandler,
  REAL_ITEM_XPANDER_GLS,
} from "../../helpers/mobixApi.js";
import { mswServer } from "../../helpers/msw.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { asUploadAsset, createFakeUploadAsset } from "../../helpers/uploadAsset.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const clock = () => new Date("2026-08-17T13:03:09.000Z");

/** Serves the real listing API at the DEFAULT origin the factory derives from DEFAULT_LISTING_URL. */
function serveDefaults() {
  const listing = listingHandler([[REAL_ITEM_XPANDER_GLS]]);
  const detail = detailHandler();
  mswServer.use(listing.handler, detail.handler, photoHandler());
  return { listing, detail };
}

describe("MobixScraperFactory", () => {
  it("wires a working MobixScraperService against the real API derived from the default listing URL", async () => {
    serveDefaults();
    const publisher = createFakePublisher();

    const service = MobixScraperFactory.create({ publisher, now: clock });
    const result = await service.scrapeInventoryUnits();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.model).toBe("Xpander GLS MT");
    }
  });

  it("defaults to the wall clock when now is not provided", async () => {
    serveDefaults();
    const publisher = createFakePublisher();

    const service = MobixScraperFactory.create({ publisher });
    const result = await service.scrapeInventoryUnits();

    expect(result.ok).toBe(true);
  });

  it("honors a custom listingUrl, deriving the API base from ITS origin", async () => {
    const listing = listingHandler([[REAL_ITEM_XPANDER_GLS]]);
    const customPages: number[] = [];
    mswServer.use(
      listing.handler,
      // Registered on the CUSTOM origin. Only this handler should see traffic — proving the API base
      // really follows listingUrl's origin rather than staying pinned to mobixbydss.id.
      http.post("https://example.test/api/get-all-produk", async ({ request }) => {
        const body = (await request.json()) as { page?: number };
        customPages.push(body.page ?? 1);
        return HttpResponse.json(
          listingResponse({ page: 1, totalPages: 1, items: [REAL_ITEM_XPANDER_GLS] }),
        );
      }),
    );
    const publisher = createFakePublisher();

    const service = MobixScraperFactory.create({
      publisher,
      listingUrl: "https://example.test/produk",
      now: clock,
    });
    const result = await service.scrapeInventoryUnits();

    expect(result.ok).toBe(true);
    expect(customPages).toEqual([1]);
    expect(listing.requestedPages).toEqual([]);
  });

  it("honors an explicit apiBaseUrl override for both the listing and detail endpoints", async () => {
    const { listing, detail } = serveDefaults();
    const publisher = createFakePublisher();
    const fakeUploadAsset = createFakeUploadAsset();

    const service = MobixScraperFactory.create({
      publisher,
      now: clock,
      // A listing URL on a different origin, with the API pinned back to the real one.
      listingUrl: "https://example.test/produk",
      apiBaseUrl: "https://mobixbydss.id",
      uploadAsset: asUploadAsset(fakeUploadAsset),
      tenantId: "dss-motor",
    });
    const result = await service.runFullScrape();

    expect(result.ok).toBe(true);
    expect(listing.requestedPages).toEqual([1]);
    expect(detail.requestedSlugs).toEqual([REAL_ITEM_XPANDER_GLS.slug]);
  });

  it("wires the detail fetcher through, so RunFullScrape ingests each new unit's FULL gallery", async () => {
    const { detail } = serveDefaults();
    const publisher = createFakePublisher();
    const fakeUploadAsset = createFakeUploadAsset();

    const service = MobixScraperFactory.create({
      publisher,
      now: clock,
      uploadAsset: asUploadAsset(fakeUploadAsset),
      tenantId: "dss-motor",
      photoTimeoutMs: 5000,
    });
    const result = await service.runFullScrape();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.photoResults).toHaveLength(1);
      // 3 gallery photos, not 1 thumbnail — the factory really passed the detail fetcher down.
      expect(result.value.photoResults[0]?.succeeded).toHaveLength(3);
    }
    expect(fakeUploadAsset.calls).toHaveLength(3);
    expect(fakeUploadAsset.calls[0]?.tenantId).toBe("dss-motor");
    expect(detail.requestedSlugs).toEqual([REAL_ITEM_XPANDER_GLS.slug]);
  });

  it("wires the detail fetcher through to scrapeUnit() as well", async () => {
    const { detail } = serveDefaults();
    const publisher = createFakePublisher();
    const fakeUploadAsset = createFakeUploadAsset();

    const service = MobixScraperFactory.create({
      publisher,
      now: clock,
      uploadAsset: asUploadAsset(fakeUploadAsset),
      tenantId: "dss-motor",
    });
    const result = await service.scrapeUnit(
      `https://mobixbydss.id/produk/${REAL_ITEM_XPANDER_GLS.slug}`,
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.photoResult?.succeeded).toHaveLength(3);
    expect(detail.requestedSlugs).toEqual([REAL_ITEM_XPANDER_GLS.slug]);
  });

  it("runFullScrape() skips photo ingestion (empty photoResults) when uploadAsset is not supplied", async () => {
    const { detail } = serveDefaults();
    const publisher = createFakePublisher();

    const service = MobixScraperFactory.create({ publisher, now: clock });
    const result = await service.runFullScrape();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.photoResults).toHaveLength(0);
    // No photo step ⇒ no detail requests either.
    expect(detail.requestedSlugs).toEqual([]);
  });

  it("defaults tenantId to 'default' when uploadAsset is supplied without an explicit tenantId", async () => {
    serveDefaults();
    const publisher = createFakePublisher();
    const fakeUploadAsset = createFakeUploadAsset();

    const service = MobixScraperFactory.create({
      publisher,
      now: clock,
      uploadAsset: asUploadAsset(fakeUploadAsset),
    });
    await service.runFullScrape();

    expect(fakeUploadAsset.calls[0]?.tenantId).toBe("default");
  });
});

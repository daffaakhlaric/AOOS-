import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { MobixScraperFactory } from "../../../src/factories/MobixScraperFactory.js";
import { mswServer } from "../../helpers/msw.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { asUploadAsset, createFakeUploadAsset } from "../../helpers/uploadAsset.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const clock = () => new Date("2026-08-07T00:00:00.000Z");

const LISTING_HTML = `<article class="unit-card" data-branch="CINERE" data-available="true">
  <a class="unit-card__link" href="https://mobixbydss.id/unit/brio-1">
    <h3 class="unit-card__title">Honda Brio 2020</h3>
    <span class="unit-card__price">Rp 150.000.000</span>
    <span class="unit-card__km">10.000 km</span>
    <span class="unit-card__transmission">AT</span>
    <span class="unit-card__color">Merah</span>
  </a>
</article>`;

const LISTING_HTML_WITH_PHOTO = `<article class="unit-card" data-branch="CINERE" data-available="true">
  <a class="unit-card__link" href="https://mobixbydss.id/unit/brio-1">
    <img src="https://mobixbydss.id/photos/brio-1.jpg" />
    <h3 class="unit-card__title">Honda Brio 2020</h3>
    <span class="unit-card__price">Rp 150.000.000</span>
    <span class="unit-card__km">10.000 km</span>
    <span class="unit-card__transmission">AT</span>
    <span class="unit-card__color">Merah</span>
  </a>
</article>`;
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

describe("MobixScraperFactory", () => {
  it("wires a working MobixScraperService with default URLs", async () => {
    mswServer.use(http.get("https://mobixbydss.id/unit", () => HttpResponse.html(LISTING_HTML)));
    const publisher = createFakePublisher();

    const service = MobixScraperFactory.create({ publisher, now: clock });
    const result = await service.scrapeInventoryUnits();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(1);
  });

  it("defaults to the wall clock when now is not provided", async () => {
    mswServer.use(http.get("https://mobixbydss.id/unit", () => HttpResponse.html(LISTING_HTML)));
    const publisher = createFakePublisher();

    const service = MobixScraperFactory.create({ publisher });
    const result = await service.scrapeInventoryUnits();

    expect(result.ok).toBe(true);
  });

  it("honors custom listingUrl/promoUrl overrides", async () => {
    mswServer.use(
      http.get("https://example.test/custom-unit", () => HttpResponse.html(LISTING_HTML)),
    );
    const publisher = createFakePublisher();

    const service = MobixScraperFactory.create({
      publisher,
      listingUrl: "https://example.test/custom-unit",
      promoUrl: "https://example.test/custom-promo",
      now: clock,
    });
    const result = await service.scrapeInventoryUnits();

    expect(result.ok).toBe(true);
  });

  it("wires DownloadAndStorePhotos/RunFullScrape end-to-end when uploadAsset + tenantId are supplied", async () => {
    mswServer.use(
      http.get("https://mobixbydss.id/unit", () => HttpResponse.html(LISTING_HTML_WITH_PHOTO)),
      http.get("https://mobixbydss.id/photos/brio-1.jpg", () =>
        HttpResponse.arrayBuffer(JPEG_BYTES.buffer, { headers: { "content-type": "image/jpeg" } }),
      ),
    );
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
      expect(result.value.photoResults[0]?.succeeded).toHaveLength(1);
    }
    expect(fakeUploadAsset.calls).toHaveLength(1);
    expect(fakeUploadAsset.calls[0]?.tenantId).toBe("dss-motor");
  });

  it("runFullScrape() skips photo ingestion (empty photoResults) when uploadAsset is not supplied", async () => {
    mswServer.use(http.get("https://mobixbydss.id/unit", () => HttpResponse.html(LISTING_HTML)));
    const publisher = createFakePublisher();

    const service = MobixScraperFactory.create({ publisher, now: clock });
    const result = await service.runFullScrape();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.photoResults).toHaveLength(0);
  });

  it("defaults tenantId to 'default' when uploadAsset is supplied without an explicit tenantId", async () => {
    mswServer.use(
      http.get("https://mobixbydss.id/unit", () => HttpResponse.html(LISTING_HTML_WITH_PHOTO)),
      http.get("https://mobixbydss.id/photos/brio-1.jpg", () =>
        HttpResponse.arrayBuffer(JPEG_BYTES.buffer, { headers: { "content-type": "image/jpeg" } }),
      ),
    );
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

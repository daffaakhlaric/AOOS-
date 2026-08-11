import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { MobixScraperFactory } from "../../../src/factories/MobixScraperFactory.js";
import { mswServer } from "../../helpers/msw.js";
import { createFakePublisher } from "../../helpers/publisher.js";

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
});

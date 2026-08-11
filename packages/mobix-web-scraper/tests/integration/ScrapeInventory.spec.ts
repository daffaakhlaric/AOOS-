import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { ScrapeInventory } from "../../src/application/use-cases/ScrapeInventory.js";
import { MobixScraperEvents } from "../../src/domain/events/MobixScraperEvents.js";
import { MobixInventoryScraper } from "../../src/infrastructure/scrapers/MobixInventoryScraper.js";
import { mswServer } from "../helpers/msw.js";
import { createFakePublisher } from "../helpers/publisher.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const LISTING_URL = "https://mobixbydss.id/unit";
const clock = () => new Date("2026-08-07T00:00:00.000Z");

const LISTING_HTML = `<html><body>
<article class="unit-card" data-branch="BINTARO" data-available="true">
  <a class="unit-card__link" href="https://mobixbydss.id/unit/xpander-cross-2019-abc123">
    <img src="https://mobixbydss.id/photos/abc123-1.jpg" />
    <h3 class="unit-card__title">Mitsubishi Xpander Cross 2019</h3>
    <span class="unit-card__price">Rp 195.000.000</span>
    <span class="unit-card__km">45.000 km</span>
    <span class="unit-card__transmission">AT</span>
    <span class="unit-card__color">Putih</span>
  </a>
</article>
</body></html>`;

function makeUseCase() {
  const publisher = createFakePublisher();
  const events = new MobixScraperEvents(publisher);
  const scraper = new MobixInventoryScraper({ listingUrl: LISTING_URL, clock });
  const useCase = new ScrapeInventory(scraper, events, clock);
  return { useCase, publisher };
}

describe("ScrapeInventory (integration, MSW-mocked mobixbydss.id)", () => {
  it("scrapes and parses the listing page into a ScrapeSession", async () => {
    mswServer.use(http.get(LISTING_URL, () => HttpResponse.html(LISTING_HTML)));
    const { useCase, publisher } = makeUseCase();

    const result = await useCase.execute();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.unitCount).toBe(1);
      expect(result.value.units[0]?.model).toBe("Xpander Cross");
    }
    const completed = publisher.published.find(
      (p) => p.type === "aaos.mobix-scraper.scrape.completed",
    );
    expect(completed).toBeDefined();
  });

  it("publishes ScrapeFailed and returns an error on non-2xx status", async () => {
    mswServer.use(http.get(LISTING_URL, () => new HttpResponse(null, { status: 503 })));
    const { useCase, publisher } = makeUseCase();

    const result = await useCase.execute();

    expect(result.ok).toBe(false);
    const failed = publisher.published.find((p) => p.type === "aaos.mobix-scraper.scrape.failed");
    expect(failed).toBeDefined();
  });

  it("publishes ScrapeFailed and returns an error when the page has no unit cards", async () => {
    mswServer.use(
      http.get(LISTING_URL, () => HttpResponse.html("<html><body>empty</body></html>")),
    );
    const { useCase, publisher } = makeUseCase();

    const result = await useCase.execute();

    expect(result.ok).toBe(false);
    const failed = publisher.published.find((p) => p.type === "aaos.mobix-scraper.scrape.failed");
    expect(failed).toBeDefined();
  });

  it("publishes ScrapeFailed on a network-level fetch error", async () => {
    mswServer.use(http.get(LISTING_URL, () => HttpResponse.error()));
    const { useCase, publisher } = makeUseCase();

    const result = await useCase.execute();

    expect(result.ok).toBe(false);
    const failed = publisher.published.find((p) => p.type === "aaos.mobix-scraper.scrape.failed");
    expect(failed).toBeDefined();
  });

  it("uses the real-time default clock when none is injected", async () => {
    mswServer.use(http.get(LISTING_URL, () => HttpResponse.html(LISTING_HTML)));
    const publisher = createFakePublisher();
    const events = new MobixScraperEvents(publisher);
    const scraper = new MobixInventoryScraper({ listingUrl: LISTING_URL, clock });
    const useCase = new ScrapeInventory(scraper, events);

    const result = await useCase.execute();

    expect(result.ok).toBe(true);
  });
});

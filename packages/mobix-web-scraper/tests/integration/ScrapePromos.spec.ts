import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { ScrapePromos } from "../../src/application/use-cases/ScrapePromos.js";
import { MobixScraperEvents } from "../../src/domain/events/MobixScraperEvents.js";
import { MobixPromoScraper } from "../../src/infrastructure/scrapers/MobixPromoScraper.js";
import { mswServer } from "../helpers/msw.js";
import { createFakePublisher } from "../helpers/publisher.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const PROMO_URL = "https://mobixbydss.id/promo";
const clock = () => new Date("2026-08-07T00:00:00.000Z");

const PROMO_HTML = `<html><body>
<section class="promo-card">
  <h3 class="promo-card__title">DP Ringan Mulai 10 Juta</h3>
  <p class="promo-card__desc">Simulasi kredit transparan</p>
  <span class="promo-card__valid-until">2026-08-31</span>
</section>
</body></html>`;

function makeUseCase() {
  const publisher = createFakePublisher();
  const events = new MobixScraperEvents(publisher);
  const scraper = new MobixPromoScraper({ promoUrl: PROMO_URL, clock });
  const useCase = new ScrapePromos(scraper, events, clock);
  return { useCase, publisher };
}

describe("ScrapePromos (integration, MSW-mocked mobixbydss.id)", () => {
  it("scrapes and parses the promo page, publishing PromoDetected per promo", async () => {
    mswServer.use(http.get(PROMO_URL, () => HttpResponse.html(PROMO_HTML)));
    const { useCase, publisher } = makeUseCase();

    const result = await useCase.execute();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.title).toBe("DP Ringan Mulai 10 Juta");
    }
    const detected = publisher.published.filter(
      (p) => p.type === "aaos.mobix-scraper.promo.detected",
    );
    expect(detected).toHaveLength(1);
  });

  it("publishes ScrapeFailed on non-2xx status", async () => {
    mswServer.use(http.get(PROMO_URL, () => new HttpResponse(null, { status: 500 })));
    const { useCase, publisher } = makeUseCase();

    const result = await useCase.execute();

    expect(result.ok).toBe(false);
    const failed = publisher.published.find((p) => p.type === "aaos.mobix-scraper.scrape.failed");
    expect(failed).toBeDefined();
  });

  it("uses the real-time default clock when none is injected", async () => {
    mswServer.use(http.get(PROMO_URL, () => HttpResponse.html(PROMO_HTML)));
    const publisher = createFakePublisher();
    const events = new MobixScraperEvents(publisher);
    const scraper = new MobixPromoScraper({ promoUrl: PROMO_URL, clock });
    const useCase = new ScrapePromos(scraper, events);

    const result = await useCase.execute();

    expect(result.ok).toBe(true);
  });
});

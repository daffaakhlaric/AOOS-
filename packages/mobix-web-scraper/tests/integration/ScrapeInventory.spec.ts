import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { ScrapeInventory } from "../../src/application/use-cases/ScrapeInventory.js";
import { MobixScraperEvents } from "../../src/domain/events/MobixScraperEvents.js";
import { MobixInventoryScraper } from "../../src/infrastructure/scrapers/MobixInventoryScraper.js";
import {
  LISTING_API_URL,
  LISTING_PAGE_URL,
  listingHandler,
  REAL_ITEM_XPANDER_CROSS,
  REAL_ITEM_XPANDER_GLS,
} from "../helpers/mobixApi.js";
import { mswServer } from "../helpers/msw.js";
import { createFakePublisher } from "../helpers/publisher.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const clock = () => new Date("2026-08-17T13:03:09.000Z");

function makeUseCase() {
  const publisher = createFakePublisher();
  const events = new MobixScraperEvents(publisher);
  const scraper = new MobixInventoryScraper({ listingUrl: LISTING_PAGE_URL, clock });
  const useCase = new ScrapeInventory(scraper, events, clock);
  return { useCase, publisher };
}

describe("ScrapeInventory (integration, MSW-mocked mobixbydss.id JSON API)", () => {
  it("scrapes the real listing API into a ScrapeSession and publishes ScrapeCompleted", async () => {
    const { handler } = listingHandler([[REAL_ITEM_XPANDER_GLS]]);
    mswServer.use(handler);
    const { useCase, publisher } = makeUseCase();

    const result = await useCase.execute();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.unitCount).toBe(1);
      expect(result.value.units[0]?.model).toBe("Xpander GLS MT");
      expect(result.value.units[0]?.brand).toBe("Mitsubishi");
    }
    expect(
      publisher.published.find((p) => p.type === "aaos.mobix-scraper.scrape.completed"),
    ).toBeDefined();
  });

  it("accumulates units across every page of a real multi-page listing", async () => {
    const { handler, requestedPages } = listingHandler([
      [REAL_ITEM_XPANDER_GLS],
      [REAL_ITEM_XPANDER_CROSS],
    ]);
    mswServer.use(handler);
    const { useCase } = makeUseCase();

    const result = await useCase.execute();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.unitCount).toBe(2);
    expect(requestedPages).toEqual([1, 2]);
  });

  it("forwards branch_fallback warnings out of the use case", async () => {
    const { handler } = listingHandler([[REAL_ITEM_XPANDER_CROSS]]);
    mswServer.use(handler);
    const { useCase } = makeUseCase();
    const warnings: string[] = [];

    const result = await useCase.execute((warning) => warnings.push(warning.rawCabang));

    expect(result.ok).toBe(true);
    expect(warnings).toEqual(["PONDOK BAMBU"]);
  });

  it("publishes ScrapeFailed and returns an error on non-2xx status", async () => {
    mswServer.use(http.post(LISTING_API_URL, () => new HttpResponse(null, { status: 503 })));
    const { useCase, publisher } = makeUseCase();

    const result = await useCase.execute();

    expect(result.ok).toBe(false);
    expect(
      publisher.published.find((p) => p.type === "aaos.mobix-scraper.scrape.failed"),
    ).toBeDefined();
  });

  it("publishes ScrapeFailed when the endpoint returns HTML instead of JSON", async () => {
    mswServer.use(
      http.post(LISTING_API_URL, () => HttpResponse.html("<html><body>maintenance</body></html>")),
    );
    const { useCase, publisher } = makeUseCase();

    const result = await useCase.execute();

    expect(result.ok).toBe(false);
    expect(
      publisher.published.find((p) => p.type === "aaos.mobix-scraper.scrape.failed"),
    ).toBeDefined();
  });

  it("returns an EMPTY session (not a failure) when the real API reports zero units", async () => {
    const { handler } = listingHandler([]);
    mswServer.use(handler);
    const { useCase, publisher } = makeUseCase();

    const result = await useCase.execute();

    // Unlike the old HTML parser (which treated "no cards found" as a parse error), an empty JSON
    // `data` array is a legitimate, unambiguous "no stock" answer from the real API.
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.unitCount).toBe(0);
    expect(
      publisher.published.find((p) => p.type === "aaos.mobix-scraper.scrape.completed"),
    ).toBeDefined();
  });

  it("publishes ScrapeFailed on a network-level fetch error", async () => {
    mswServer.use(http.post(LISTING_API_URL, () => HttpResponse.error()));
    const { useCase, publisher } = makeUseCase();

    const result = await useCase.execute();

    expect(result.ok).toBe(false);
    expect(
      publisher.published.find((p) => p.type === "aaos.mobix-scraper.scrape.failed"),
    ).toBeDefined();
  });

  it("uses the real-time default clock when none is injected", async () => {
    const { handler } = listingHandler([[REAL_ITEM_XPANDER_GLS]]);
    mswServer.use(handler);
    const publisher = createFakePublisher();
    const events = new MobixScraperEvents(publisher);
    const scraper = new MobixInventoryScraper({ listingUrl: LISTING_PAGE_URL, clock });
    const useCase = new ScrapeInventory(scraper, events);

    const result = await useCase.execute();

    expect(result.ok).toBe(true);
  });
});

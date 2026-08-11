import { afterEach, describe, expect, it, vi } from "vitest";

import { MobixPromoScraper } from "../../../src/infrastructure/scrapers/MobixPromoScraper.js";

const clock = () => new Date("2026-08-07T00:00:00.000Z");

describe("MobixPromoScraper (unit, injected fetch)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a ScrapeError when fetch rejects with a non-Error value", async () => {
    const fetchImpl = vi.fn().mockRejectedValue("network down");
    const scraper = new MobixPromoScraper({
      promoUrl: "https://mobixbydss.id/promo",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      clock,
    });

    const result = await scraper.scrape();

    expect(result.ok).toBe(false);
  });

  it("uses the global fetch and real-time clock when neither is injected", async () => {
    const html = `<section class="promo-card">
      <h3 class="promo-card__title">Promo</h3>
      <p class="promo-card__desc">desc</p>
    </section>`;
    const fetchMock = vi.fn().mockResolvedValue(new Response(html, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const scraper = new MobixPromoScraper({ promoUrl: "https://mobixbydss.id/promo" });

    const result = await scraper.scrape();

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("https://mobixbydss.id/promo");
  });

  it("returns a ScrapeError when fetch rejects", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const scraper = new MobixPromoScraper({
      promoUrl: "https://mobixbydss.id/promo",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      clock,
    });

    const result = await scraper.scrape();

    expect(result.ok).toBe(false);
  });

  it("returns a ScrapeError on non-2xx status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    const scraper = new MobixPromoScraper({
      promoUrl: "https://mobixbydss.id/promo",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      clock,
    });

    const result = await scraper.scrape();

    expect(result.ok).toBe(false);
  });

  it("returns a ParseError when the promo page has no promo cards", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("<html>empty</html>", { status: 200 }));
    const scraper = new MobixPromoScraper({
      promoUrl: "https://mobixbydss.id/promo",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      clock,
    });

    const result = await scraper.scrape();

    expect(result.ok).toBe(false);
  });

  it("parses promos on success", async () => {
    const html = `<section class="promo-card">
      <h3 class="promo-card__title">Promo</h3>
      <p class="promo-card__desc">desc</p>
    </section>`;
    const fetchImpl = vi.fn().mockResolvedValue(new Response(html, { status: 200 }));
    const scraper = new MobixPromoScraper({
      promoUrl: "https://mobixbydss.id/promo",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      clock,
    });

    const result = await scraper.scrape();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(1);
  });
});

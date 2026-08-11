import { afterEach, describe, expect, it, vi } from "vitest";

import { MobixInventoryScraper } from "../../../src/infrastructure/scrapers/MobixInventoryScraper.js";

const clock = () => new Date("2026-08-07T00:00:00.000Z");

const LISTING_HTML = `<article class="unit-card" data-branch="BINTARO" data-available="true">
  <a class="unit-card__link" href="https://mobixbydss.id/unit/xpander-cross-2019-abc123">
    <h3 class="unit-card__title">Mitsubishi Xpander Cross 2019</h3>
    <span class="unit-card__price">Rp 195.000.000</span>
    <span class="unit-card__km">45.000 km</span>
    <span class="unit-card__transmission">AT</span>
    <span class="unit-card__color">Putih</span>
  </a>
</article>`;

describe("MobixInventoryScraper (unit, injected fetch)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a ScrapeError when fetch rejects", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const scraper = new MobixInventoryScraper({
      listingUrl: "https://mobixbydss.id/unit",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      clock,
    });

    const result = await scraper.scrape();

    expect(result.ok).toBe(false);
  });

  it("returns a ScrapeError when fetch rejects with a non-Error value", async () => {
    const fetchImpl = vi.fn().mockRejectedValue("network down");
    const scraper = new MobixInventoryScraper({
      listingUrl: "https://mobixbydss.id/unit",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      clock,
    });

    const result = await scraper.scrape();

    expect(result.ok).toBe(false);
  });

  it("returns a ScrapeError on non-2xx status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    const scraper = new MobixInventoryScraper({
      listingUrl: "https://mobixbydss.id/unit",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      clock,
    });

    const result = await scraper.scrape();

    expect(result.ok).toBe(false);
  });

  it("parses units on success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(LISTING_HTML, { status: 200 }));
    const scraper = new MobixInventoryScraper({
      listingUrl: "https://mobixbydss.id/unit",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      clock,
    });

    const result = await scraper.scrape();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.unitCount).toBe(1);
  });

  it("uses the global fetch and real-time clock when neither is injected", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(LISTING_HTML, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const scraper = new MobixInventoryScraper({ listingUrl: "https://mobixbydss.id/unit" });

    const result = await scraper.scrape();

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("https://mobixbydss.id/unit");
  });
});

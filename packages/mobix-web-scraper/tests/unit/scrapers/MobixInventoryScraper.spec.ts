import { describe, expect, it, vi } from "vitest";

import type { ScrapeWarning } from "../../../src/domain/events/ScrapeWarning.js";
import { MobixInventoryScraper } from "../../../src/infrastructure/scrapers/MobixInventoryScraper.js";
import {
  API_ORIGIN,
  LISTING_API_URL,
  LISTING_PAGE_URL,
  listingResponse,
  REAL_ITEM_XPANDER_CROSS,
  REAL_ITEM_XPANDER_GLS,
  realItemWithoutOdometer,
} from "../../helpers/mobixApi.js";

const clock = () => new Date("2026-08-17T13:03:09.000Z");

/** A `fetch` stub over the real listing API: serves `pages[page-1]` and records requested pages. */
function fetchPages(pages: ReadonlyArray<ReadonlyArray<Record<string, unknown>>>) {
  const requestedPages: number[] = [];
  const requestedUrls: string[] = [];
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    requestedUrls.push(String(url));
    const body = JSON.parse(String(init?.body ?? "{}")) as { page?: number };
    const page = body.page ?? 1;
    requestedPages.push(page);
    return new Response(
      JSON.stringify(
        listingResponse({ page, totalPages: pages.length, items: pages[page - 1] ?? [] }),
      ),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, requestedPages, requestedUrls };
}

function scraper(fetchImpl: typeof fetch, overrides: Record<string, unknown> = {}) {
  return new MobixInventoryScraper({
    listingUrl: LISTING_PAGE_URL,
    fetchImpl,
    clock,
    ...overrides,
  });
}

describe("MobixInventoryScraper (real JSON API, injected fetch)", () => {
  it("POSTs {page:1} as JSON to <origin>/api/get-all-produk, derived from the listing URL", async () => {
    const { fetchImpl, requestedUrls } = fetchPages([[REAL_ITEM_XPANDER_GLS]]);

    const result = await scraper(fetchImpl).scrape();

    expect(result.ok).toBe(true);
    expect(requestedUrls[0]).toBe(LISTING_API_URL);
    const call = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call?.[1]).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: 1 }),
    });
  });

  it("maps a real listing item into the returned ScrapeSession", async () => {
    const { fetchImpl } = fetchPages([[REAL_ITEM_XPANDER_GLS]]);

    const result = await scraper(fetchImpl).scrape();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.unitCount).toBe(1);
    expect(result.value.units[0]?.model).toBe("Xpander GLS MT");
    expect(result.value.units[0]?.identityKey).toBe(REAL_ITEM_XPANDER_GLS.slug);
    expect(result.value.sourceUrl).toBe(LISTING_API_URL);
  });

  it("walks EVERY page and stops exactly at meta.total_pages", async () => {
    // 3 pages of 2 real items each — the loop must request 1,2,3 and then stop.
    const page = [REAL_ITEM_XPANDER_GLS, REAL_ITEM_XPANDER_CROSS];
    const { fetchImpl, requestedPages } = fetchPages([page, page, page]);

    const result = await scraper(fetchImpl).scrape();

    expect(result.ok).toBe(true);
    expect(requestedPages).toEqual([1, 2, 3]);
    if (result.ok) expect(result.value.unitCount).toBe(6);
  });

  it("trusts meta.total_pages even when it disagrees with total_data/limit (real 244/12/14 case)", async () => {
    const requestedPages: number[] = [];
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { page?: number };
      const page = body.page ?? 1;
      requestedPages.push(page);
      return new Response(
        JSON.stringify({
          status: "success",
          code: 200,
          error: "",
          message: "Data berhasil ditemukan",
          data: [REAL_ITEM_XPANDER_GLS],
          // The real API's own numbers: 244 items at limit 12 would compute to 21 pages, but it
          // reports 14. The scraper must follow 14 — the authoritative value.
          meta: {
            lastRequest: "2026-08-17T13:03:09Z",
            limit: 12,
            page,
            total_data: 244,
            total_pages: 14,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const result = await scraper(fetchImpl).scrape();

    expect(result.ok).toBe(true);
    expect(requestedPages).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(requestedPages).toHaveLength(14);
  });

  it("requests only page 1 when total_pages is 1", async () => {
    const { fetchImpl, requestedPages } = fetchPages([[REAL_ITEM_XPANDER_GLS]]);

    await scraper(fetchImpl).scrape();

    expect(requestedPages).toEqual([1]);
  });

  it("returns an empty session (not an error) when the listing is genuinely empty", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify(listingResponse({ page: 1, totalPages: 0, items: [] })), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    ) as unknown as typeof fetch;

    const result = await scraper(fetchImpl).scrape();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.unitCount).toBe(0);
  });

  it("stops at maxPages as a runaway guard even if the API keeps claiming more pages", async () => {
    const requestedPages: number[] = [];
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { page?: number };
      requestedPages.push(body.page ?? 1);
      return new Response(
        JSON.stringify(
          listingResponse({
            page: body.page ?? 1,
            totalPages: 9999,
            items: [REAL_ITEM_XPANDER_GLS],
          }),
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const result = await scraper(fetchImpl, { maxPages: 3 }).scrape();

    expect(result.ok).toBe(true);
    expect(requestedPages).toEqual([1, 2, 3]);
  });

  it("handles the real missing-odometer item without failing the scrape", async () => {
    const { fetchImpl } = fetchPages([[REAL_ITEM_XPANDER_GLS, realItemWithoutOdometer()]]);

    const result = await scraper(fetchImpl).scrape();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.unitCount).toBe(2);
    expect(result.value.units[1]?.kilometer.km).toBe(0);
  });

  it("forwards branch_fallback warnings for a real PONDOK BAMBU unit to the onWarning listener", async () => {
    const { fetchImpl } = fetchPages([[REAL_ITEM_XPANDER_CROSS]]);
    const warnings: ScrapeWarning[] = [];

    const result = await scraper(fetchImpl).scrape((warning) => warnings.push(warning));

    expect(result.ok).toBe(true);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      type: "branch_fallback",
      rawCabang: "PONDOK BAMBU",
      slug: REAL_ITEM_XPANDER_CROSS.slug,
    });
  });

  it("emits one warning per offending unit across multiple pages", async () => {
    const { fetchImpl } = fetchPages([[REAL_ITEM_XPANDER_CROSS], [REAL_ITEM_XPANDER_CROSS]]);
    const warnings: ScrapeWarning[] = [];

    await scraper(fetchImpl).scrape((warning) => warnings.push(warning));

    expect(warnings).toHaveLength(2);
  });

  it("scrapes fine with no onWarning listener supplied", async () => {
    const { fetchImpl } = fetchPages([[REAL_ITEM_XPANDER_CROSS]]);

    const result = await scraper(fetchImpl).scrape();

    expect(result.ok).toBe(true);
  });

  it("returns a ScrapeError when fetch rejects", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));

    const result = await scraper(fetchImpl as unknown as typeof fetch).scrape();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("fetch failed");
  });

  it("returns a ScrapeError when fetch rejects with a non-Error value", async () => {
    const fetchImpl = vi.fn().mockRejectedValue("network down");

    const result = await scraper(fetchImpl as unknown as typeof fetch).scrape();

    expect(result.ok).toBe(false);
  });

  it("returns a ScrapeError on non-2xx status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));

    const result = await scraper(fetchImpl as unknown as typeof fetch).scrape();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("500");
  });

  it("returns a ScrapeError when the body is not valid JSON (e.g. an HTML error page)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("<html>maintenance</html>", { status: 200 }));

    const result = await scraper(fetchImpl as unknown as typeof fetch).scrape();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("not valid JSON");
  });

  it("returns a ParseError when the envelope is missing its meta block", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: "success", data: [] }), { status: 200 }),
      );

    const result = await scraper(fetchImpl as unknown as typeof fetch).scrape();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("meta");
  });

  it("fails the scrape when a single item is malformed, rather than silently dropping it", async () => {
    const { fetchImpl } = fetchPages([
      [REAL_ITEM_XPANDER_GLS, { ...REAL_ITEM_XPANDER_CROSS, transmisi: "WARP DRIVE" }],
    ]);

    const result = await scraper(fetchImpl).scrape();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("WARP DRIVE");
  });

  it("returns a ScrapeError when listingUrl is not an absolute URL", async () => {
    const { fetchImpl } = fetchPages([[REAL_ITEM_XPANDER_GLS]]);

    const result = await scraper(fetchImpl, { listingUrl: "/produk" }).scrape();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("absolute URL");
  });

  it("honors an explicit apiBaseUrl override instead of deriving from listingUrl", async () => {
    const { fetchImpl, requestedUrls } = fetchPages([[REAL_ITEM_XPANDER_GLS]]);

    await scraper(fetchImpl, { apiBaseUrl: "https://staging.mobixbydss.id" }).scrape();

    expect(requestedUrls[0]).toBe("https://staging.mobixbydss.id/api/get-all-produk");
  });

  it("returns a ScrapeError when an explicit apiBaseUrl is invalid", async () => {
    const { fetchImpl } = fetchPages([[REAL_ITEM_XPANDER_GLS]]);

    const result = await scraper(fetchImpl, { apiBaseUrl: "nope" }).scrape();

    expect(result.ok).toBe(false);
  });

  it("uses the global fetch and real-time clock when neither is injected", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify(
            listingResponse({ page: 1, totalPages: 1, items: [REAL_ITEM_XPANDER_GLS] }),
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await new MobixInventoryScraper({ listingUrl: LISTING_PAGE_URL }).scrape();

      expect(result.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(`${API_ORIGIN}/api/get-all-produk`, expect.anything());
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

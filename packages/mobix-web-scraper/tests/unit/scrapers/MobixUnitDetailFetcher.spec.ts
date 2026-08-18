import { describe, expect, it, vi } from "vitest";

import { MobixUnitDetailFetcher } from "../../../src/infrastructure/scrapers/MobixUnitDetailFetcher.js";
import {
  DETAIL_API_URL,
  LISTING_PAGE_URL,
  REAL_DETAIL_PHOTO_URLS,
  REAL_DETAIL_RESPONSE,
  REAL_ITEM_XPANDER_GLS,
} from "../../helpers/mobixApi.js";

function fetchDetail(response: unknown = REAL_DETAIL_RESPONSE) {
  const requestedBodies: string[] = [];
  const requestedUrls: string[] = [];
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    requestedUrls.push(String(url));
    requestedBodies.push(String(init?.body ?? ""));
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, requestedBodies, requestedUrls };
}

function fetcher(fetchImpl: typeof fetch, overrides: Record<string, unknown> = {}) {
  return new MobixUnitDetailFetcher({ listingUrl: LISTING_PAGE_URL, fetchImpl, ...overrides });
}

describe("MobixUnitDetailFetcher (real /api/get-detail-produk)", () => {
  it("POSTs {slug} to <origin>/api/get-detail-produk", async () => {
    const { fetchImpl, requestedUrls, requestedBodies } = fetchDetail();

    const result = await fetcher(fetchImpl).fetchDetail(REAL_ITEM_XPANDER_GLS.slug);

    expect(result.ok).toBe(true);
    expect(requestedUrls[0]).toBe(DETAIL_API_URL);
    expect(requestedBodies[0]).toBe(JSON.stringify({ slug: REAL_ITEM_XPANDER_GLS.slug }));
  });

  it("returns the FULL galeri as absolute URLs, not just one thumbnail", async () => {
    const { fetchImpl } = fetchDetail();

    const result = await fetcher(fetchImpl).fetchDetail(REAL_ITEM_XPANDER_GLS.slug);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.photos).toEqual(REAL_DETAIL_PHOTO_URLS);
    expect(result.value.photos).toHaveLength(3);
    for (const url of result.value.photos) {
      // Real photo CDN host — NOT mobixbydss.id itself (that 404s unconditionally; see
      // `absolutePhotoUrl`'s docstring in `MobixUnitMapper.ts`).
      expect(url.startsWith("https://mobix.motovax.com/unit-file-serve?path=")).toBe(true);
      expect(new URL(url).searchParams.get("raw")).toBe("1");
    }
  });

  it("returns the real deskripsi and slug", async () => {
    const { fetchImpl } = fetchDetail();

    const result = await fetcher(fetchImpl).fetchDetail(REAL_ITEM_XPANDER_GLS.slug);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.slug).toBe(REAL_ITEM_XPANDER_GLS.slug);
    expect(result.value.description).toContain("Interior luas");
  });

  it("treats an absent galeri as an empty photo list rather than an error", async () => {
    const { galeri: _dropped, ...dataWithoutGaleri } = REAL_DETAIL_RESPONSE.data;
    const { fetchImpl } = fetchDetail({ ...REAL_DETAIL_RESPONSE, data: dataWithoutGaleri });

    const result = await fetcher(fetchImpl).fetchDetail(REAL_ITEM_XPANDER_GLS.slug);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.photos).toEqual([]);
  });

  it("omits description when deskripsi is absent", async () => {
    const { deskripsi: _dropped, ...dataWithoutDesc } = REAL_DETAIL_RESPONSE.data;
    const { fetchImpl } = fetchDetail({ ...REAL_DETAIL_RESPONSE, data: dataWithoutDesc });

    const result = await fetcher(fetchImpl).fetchDetail(REAL_ITEM_XPANDER_GLS.slug);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.description).toBeUndefined();
  });

  it.each([[""], ["   "]])("rejects a blank slug (%s) without making a request", async (slug) => {
    const { fetchImpl } = fetchDetail();

    const result = await fetcher(fetchImpl).fetchDetail(slug);

    expect(result.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a non-string slug", async () => {
    const { fetchImpl } = fetchDetail();

    const result = await fetcher(fetchImpl).fetchDetail(undefined as unknown as string);

    expect(result.ok).toBe(false);
  });

  it("returns a ScrapeError when fetch rejects", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));

    const result = await fetcher(fetchImpl as unknown as typeof fetch).fetchDetail("slug-1");

    expect(result.ok).toBe(false);
  });

  it("returns a ScrapeError on non-2xx status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));

    const result = await fetcher(fetchImpl as unknown as typeof fetch).fetchDetail("slug-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("404");
  });

  it("returns a ScrapeError on a non-JSON body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("<html>nope</html>", { status: 200 }));

    const result = await fetcher(fetchImpl as unknown as typeof fetch).fetchDetail("slug-1");

    expect(result.ok).toBe(false);
  });

  it("returns a ParseError when the detail envelope has no data.slug", async () => {
    const { fetchImpl } = fetchDetail({ status: "success", data: {} });

    const result = await fetcher(fetchImpl).fetchDetail("slug-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("slug");
  });

  it("returns a ScrapeError when listingUrl is not absolute", async () => {
    const { fetchImpl } = fetchDetail();

    const result = await fetcher(fetchImpl, { listingUrl: "/produk" }).fetchDetail("slug-1");

    expect(result.ok).toBe(false);
  });

  it("honors an explicit apiBaseUrl override", async () => {
    const { fetchImpl, requestedUrls } = fetchDetail();

    await fetcher(fetchImpl, { apiBaseUrl: "https://staging.mobixbydss.id" }).fetchDetail("slug-1");

    expect(requestedUrls[0]).toBe("https://staging.mobixbydss.id/api/get-detail-produk");
  });

  it("returns a ScrapeError when an explicit apiBaseUrl is invalid", async () => {
    const { fetchImpl } = fetchDetail();

    const result = await fetcher(fetchImpl, { apiBaseUrl: "nope" }).fetchDetail("slug-1");

    expect(result.ok).toBe(false);
  });

  it("uses the global fetch when none is injected", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(REAL_DETAIL_RESPONSE), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await new MobixUnitDetailFetcher({
        listingUrl: LISTING_PAGE_URL,
      }).fetchDetail(REAL_ITEM_XPANDER_GLS.slug);

      expect(result.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

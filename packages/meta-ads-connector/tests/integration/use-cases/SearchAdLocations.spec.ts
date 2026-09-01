import { createMockLogger } from "@aos/testing";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { SearchAdLocations } from "../../../src/application/use-cases/SearchAdLocations.js";
import { MetaApiClient } from "../../../src/infrastructure/meta-api/MetaApiClient.js";
import { TokenBucketRateLimiter } from "../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../../../src/infrastructure/retry/ExponentialBackoffRetry.js";
import { REAL_AD_LOCATION_ROWS } from "../../helpers/ad-location-fixtures.js";
import { mswServer } from "../../helpers/msw.js";
import { unwrap } from "../../helpers/result.js";
import { createFakeTracer } from "../../helpers/tracer.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const SEARCH_URL = "https://graph.facebook.com/v21.0/search";

function makeUseCase(options: { readonly rateLimiterCapacity?: number } = {}) {
  const client = new MetaApiClient();
  const rateLimiter = new TokenBucketRateLimiter(
    options.rateLimiterCapacity !== undefined ? { capacity: options.rateLimiterCapacity } : {},
  );
  const retry = new ExponentialBackoffRetry({ sleep: async () => undefined });
  const logger = createMockLogger();
  return new SearchAdLocations(client, rateLimiter, retry, logger as never, createFakeTracer());
}

/**
 * AAOS EPIC S, Phase S2 — exercised over MSW-mocked Meta Graph API responses shaped per Meta's
 * documented "Targeting Search" reference (no live call available — see
 * `tests/helpers/ad-location-fixtures.ts`'s provenance note).
 */
describe("SearchAdLocations (MSW-mocked Meta API)", () => {
  it('GETs /search with type=adgeolocation, location_types=["city"], and the exact query, and maps the real response shape', async () => {
    let receivedUrl: URL | undefined;
    mswServer.use(
      http.get(SEARCH_URL, ({ request }) => {
        receivedUrl = new URL(request.url);
        return HttpResponse.json({ data: [REAL_AD_LOCATION_ROWS.bandung] });
      }),
    );

    const locations = unwrap(
      await makeUseCase().execute({ query: "Bandung", locationType: "city", accessToken: "TOKEN" }),
    );

    expect(receivedUrl?.searchParams.get("type")).toBe("adgeolocation");
    expect(receivedUrl?.searchParams.get("location_types")).toBe('["city"]');
    expect(receivedUrl?.searchParams.get("q")).toBe("Bandung");
    expect(receivedUrl?.searchParams.get("access_token")).toBe("TOKEN");

    expect(locations).toEqual([
      {
        key: "1109310",
        name: "Bandung",
        type: "city",
        countryCode: "ID",
        countryName: "Indonesia",
        region: "West Java",
        regionId: 1533,
        supportsRegion: true,
        supportsCity: true,
        searchQuery: "Bandung",
      },
    ]);
  });

  it("returns an honest empty result (never a fabricated key) when Meta reports zero matches", async () => {
    mswServer.use(http.get(SEARCH_URL, () => HttpResponse.json({ data: [] })));

    const locations = unwrap(
      await makeUseCase().execute({
        query: "Nonexistent City Name XYZ",
        locationType: "city",
        accessToken: "T",
      }),
    );

    expect(locations).toEqual([]);
  });

  it("surfaces every real ambiguous match honestly, without auto-picking one", async () => {
    mswServer.use(
      http.get(SEARCH_URL, () =>
        HttpResponse.json({
          data: [REAL_AD_LOCATION_ROWS.manhattanKS, REAL_AD_LOCATION_ROWS.manhattanNY],
        }),
      ),
    );

    const locations = unwrap(
      await makeUseCase().execute({ query: "Manhattan", locationType: "city", accessToken: "T" }),
    );

    expect(locations).toHaveLength(2);
    expect(locations.map((l) => l.region)).toEqual(["Kansas", "New York"]);
    expect(locations.map((l) => l.key)).toEqual(["2447439", "2418779"]);
  });

  it("tolerates rows missing optional region/region_id/country_name fields", async () => {
    mswServer.use(
      http.get(SEARCH_URL, () =>
        HttpResponse.json({
          data: [{ key: "999", name: "Somewhere", type: "city", country_code: "ID" }],
        }),
      ),
    );

    const locations = unwrap(
      await makeUseCase().execute({ query: "Somewhere", locationType: "city", accessToken: "T" }),
    );
    expect(locations).toEqual([
      { key: "999", name: "Somewhere", type: "city", countryCode: "ID", searchQuery: "Somewhere" },
    ]);
  });

  it("returns err (never a fabricated location list) when Meta rejects the search", async () => {
    mswServer.use(
      http.get(SEARCH_URL, () =>
        HttpResponse.json(
          { error: { message: "Invalid OAuth access token", code: 190 } },
          { status: 400 },
        ),
      ),
    );
    const result = await makeUseCase().execute({
      query: "Bandung",
      locationType: "city",
      accessToken: "BAD",
    });
    expect(result.ok).toBe(false);
  });

  it("returns err when the response body fails schema validation (e.g. missing required key field)", async () => {
    mswServer.use(
      http.get(SEARCH_URL, () =>
        HttpResponse.json({
          data: [{ name: "Bandung", type: "city", country_code: "ID" }],
        }),
      ),
    );
    const result = await makeUseCase().execute({
      query: "Bandung",
      locationType: "city",
      accessToken: "T",
    });
    expect(result.ok).toBe(false);
  });

  it("returns err when region_id comes back as a string instead of a number", async () => {
    mswServer.use(
      http.get(SEARCH_URL, () =>
        HttpResponse.json({
          data: [{ ...REAL_AD_LOCATION_ROWS.bandung, region_id: "1533" }],
        }),
      ),
    );
    const result = await makeUseCase().execute({
      query: "Bandung",
      locationType: "city",
      accessToken: "T",
    });
    expect(result.ok).toBe(false);
  });

  it("fails fast without any HTTP call when the local rate-limit budget is exhausted", async () => {
    let called = false;
    mswServer.use(
      http.get(SEARCH_URL, () => {
        called = true;
        return HttpResponse.json({ data: [] });
      }),
    );
    const result = await makeUseCase({ rateLimiterCapacity: 0 }).execute({
      query: "Bandung",
      locationType: "city",
      accessToken: "T",
    });
    expect(result.ok).toBe(false);
    expect(called).toBe(false);
  });
});

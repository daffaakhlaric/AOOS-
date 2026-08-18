import { createMockLogger } from "@aos/testing";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { SearchAdInterests } from "../../../src/application/use-cases/SearchAdInterests.js";
import { MetaApiClient } from "../../../src/infrastructure/meta-api/MetaApiClient.js";
import { TokenBucketRateLimiter } from "../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../../../src/infrastructure/retry/ExponentialBackoffRetry.js";
import { REAL_AD_INTEREST_ROWS } from "../../helpers/ad-interest-fixtures.js";
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
  return new SearchAdInterests(client, rateLimiter, retry, logger as never, createFakeTracer());
}

/**
 * AAOS-SIMULASI-TARGETING, exercised over the real MSW-mocked Meta Graph API with VERBATIM live
 * response rows (`tests/helpers/ad-interest-fixtures.ts`) — never a live network call.
 */
describe("SearchAdInterests (MSW-mocked Meta API)", () => {
  it("GETs /search with type=adinterest and the exact query term, and maps the real response shape", async () => {
    let receivedUrl: URL | undefined;
    mswServer.use(
      http.get(SEARCH_URL, ({ request }) => {
        receivedUrl = new URL(request.url);
        return HttpResponse.json({ data: [REAL_AD_INTEREST_ROWS.automotive] });
      }),
    );

    const interests = unwrap(
      await makeUseCase().execute({ term: "automotive", accessToken: "TOKEN" }),
    );

    expect(receivedUrl?.searchParams.get("type")).toBe("adinterest");
    expect(receivedUrl?.searchParams.get("q")).toBe("automotive");
    expect(receivedUrl?.searchParams.get("access_token")).toBe("TOKEN");

    expect(interests).toEqual([
      {
        id: "6003304550260",
        name: "Automotive industry (industry)",
        audienceSizeLower: 386766403,
        audienceSizeUpper: 454837290,
        path: ["Interests", "Additional interests", "Automotive industry (industry)"],
        topic: "Hobbies and activities",
        searchTerm: "automotive",
      },
    ]);
  });

  it("accepts every real captured row shape — description null, description empty-string, and a short 2-segment path", async () => {
    mswServer.use(
      http.get(SEARCH_URL, () =>
        HttpResponse.json({
          data: [
            REAL_AD_INTEREST_ROWS.usedCar,
            REAL_AD_INTEREST_ROWS.carFinance,
            REAL_AD_INTEREST_ROWS.vehicles,
            REAL_AD_INTEREST_ROWS.family,
          ],
        }),
      ),
    );

    const interests = unwrap(await makeUseCase().execute({ term: "used car", accessToken: "T" }));

    expect(interests.map((i) => i.id)).toEqual([
      "6003257869482",
      "6003739713691",
      "6003133486214",
      "6003476182657",
    ]);
    // Every audience-size bound is Meta's own number, carried through unmodified.
    expect(interests[0]?.audienceSizeLower).toBe(61362891);
    expect(interests[2]?.path).toEqual(["Interests", "Vehicles (transportation)"]);
    // Provenance: the term that surfaced each row is recorded on every result.
    expect(interests.every((i) => i.searchTerm === "used car")).toBe(true);
  });

  it("tolerates an extra disambiguation_category field and a row with no topic", async () => {
    mswServer.use(
      http.get(SEARCH_URL, () =>
        HttpResponse.json({
          data: [
            {
              ...REAL_AD_INTEREST_ROWS.usedCar,
              disambiguation_category: "Vehicle",
            },
            {
              id: "6003000000001",
              name: "No topic row",
              audience_size_lower_bound: 1,
              audience_size_upper_bound: 2,
              path: ["Interests"],
            },
          ],
        }),
      ),
    );

    const interests = unwrap(await makeUseCase().execute({ term: "vehicle", accessToken: "T" }));
    expect(interests).toHaveLength(2);
    expect(interests[1]?.topic).toBeUndefined();
  });

  it("caps the kept results at the requested limit without dropping order", async () => {
    mswServer.use(
      http.get(SEARCH_URL, () =>
        HttpResponse.json({
          data: [
            REAL_AD_INTEREST_ROWS.automotive,
            REAL_AD_INTEREST_ROWS.usedCar,
            REAL_AD_INTEREST_ROWS.carFinance,
          ],
        }),
      ),
    );

    const interests = unwrap(
      await makeUseCase().execute({ term: "automotive", accessToken: "T", limit: 2 }),
    );
    expect(interests.map((i) => i.id)).toEqual(["6003304550260", "6003257869482"]);
  });

  it("returns err (never a fabricated interest list) when Meta rejects the search", async () => {
    mswServer.use(
      http.get(SEARCH_URL, () =>
        HttpResponse.json(
          { error: { message: "Invalid OAuth access token", code: 190 } },
          { status: 400 },
        ),
      ),
    );
    const result = await makeUseCase().execute({ term: "automotive", accessToken: "BAD" });
    expect(result.ok).toBe(false);
  });

  it("returns err when the response body fails schema validation (e.g. audience bounds as strings)", async () => {
    mswServer.use(
      http.get(SEARCH_URL, () =>
        HttpResponse.json({
          data: [{ ...REAL_AD_INTEREST_ROWS.automotive, audience_size_lower_bound: "386766403" }],
        }),
      ),
    );
    const result = await makeUseCase().execute({ term: "automotive", accessToken: "T" });
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
      term: "automotive",
      accessToken: "T",
    });
    expect(result.ok).toBe(false);
    expect(called).toBe(false);
  });
});

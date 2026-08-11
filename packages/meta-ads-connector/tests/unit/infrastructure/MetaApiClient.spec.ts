import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  AuthError,
  PermissionError,
  RateLimitError,
  ApiServerError,
} from "../../../src/domain/errors/index.js";
import { MetaApiClient } from "../../../src/infrastructure/meta-api/MetaApiClient.js";
import { mswServer } from "../../helpers/msw.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const BASE = "https://graph.facebook.com/v21.0";

describe("MetaApiClient", () => {
  it("getCampaigns() parses a valid campaign list response", async () => {
    mswServer.use(
      http.get(`${BASE}/act_123/campaigns`, () =>
        HttpResponse.json({
          data: [
            { id: "c1", name: "Campaign 1", objective: "OUTCOME_ENGAGEMENT", status: "ACTIVE" },
          ],
        }),
      ),
    );
    const client = new MetaApiClient();
    const result = await client.getCampaigns("act_123", "TOKEN", "last_30d");
    expect(unwrap(result).data[0]?.id).toBe("c1");
  });

  it("getAdSets() parses a valid adset list response", async () => {
    mswServer.use(
      http.get(`${BASE}/campaign-1/adsets`, () =>
        HttpResponse.json({ data: [{ id: "as1", name: "AdSet 1", status: "ACTIVE" }] }),
      ),
    );
    const client = new MetaApiClient();
    const result = await client.getAdSets("campaign-1", "TOKEN");
    expect(unwrap(result).data[0]?.id).toBe("as1");
  });

  it("getAds() parses a valid ad list response", async () => {
    mswServer.use(
      http.get(`${BASE}/adset-1/ads`, () =>
        HttpResponse.json({
          data: [
            { id: "ad1", name: "Ad 1", status: "ACTIVE", created_time: "2026-01-01T00:00:00+0000" },
          ],
        }),
      ),
    );
    const client = new MetaApiClient();
    const result = await client.getAds("adset-1", "TOKEN", "last_30d");
    expect(unwrap(result).data[0]?.id).toBe("ad1");
  });

  it("pauseAd() POSTs and parses a success response", async () => {
    mswServer.use(http.post(`${BASE}/ad-1`, () => HttpResponse.json({ success: true })));
    const client = new MetaApiClient();
    const result = await client.pauseAd("ad-1", "TOKEN");
    expect(unwrap(result).success).toBe(true);
  });

  it("scaleAdSetBudget() POSTs and parses a success response", async () => {
    mswServer.use(http.post(`${BASE}/adset-1`, () => HttpResponse.json({ success: true })));
    const client = new MetaApiClient();
    const result = await client.scaleAdSetBudget("adset-1", 120000, "TOKEN");
    expect(unwrap(result).success).toBe(true);
  });

  it("fixCampaignObjective() POSTs and parses a success response", async () => {
    mswServer.use(http.post(`${BASE}/campaign-1`, () => HttpResponse.json({ success: true })));
    const client = new MetaApiClient();
    const result = await client.fixCampaignObjective("campaign-1", "OUTCOME_ENGAGEMENT", "TOKEN");
    expect(unwrap(result).success).toBe(true);
  });

  it("maps Meta error code 190 to AuthError regardless of HTTP status", async () => {
    mswServer.use(
      http.get(`${BASE}/act_123/campaigns`, () =>
        HttpResponse.json({ error: { message: "token invalid", code: 190 } }, { status: 400 }),
      ),
    );
    const client = new MetaApiClient();
    const error = unwrapErr(await client.getCampaigns("act_123", "TOKEN", "last_30d"));
    expect(error).toBeInstanceOf(AuthError);
  });

  it("maps Meta error code 200 to PermissionError", async () => {
    mswServer.use(
      http.get(`${BASE}/act_123/campaigns`, () =>
        HttpResponse.json({ error: { message: "missing permission", code: 200 } }, { status: 400 }),
      ),
    );
    const client = new MetaApiClient();
    const error = unwrapErr(await client.getCampaigns("act_123", "TOKEN", "last_30d"));
    expect(error).toBeInstanceOf(PermissionError);
  });

  it("maps HTTP 429 to RateLimitError, reading Retry-After (seconds) into retryAfterMs", async () => {
    mswServer.use(
      http.get(`${BASE}/act_123/campaigns`, () =>
        HttpResponse.json(
          { error: { message: "rate limited" } },
          { status: 429, headers: { "retry-after": "30" } },
        ),
      ),
    );
    const client = new MetaApiClient();
    const error = unwrapErr(await client.getCampaigns("act_123", "TOKEN", "last_30d"));
    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).retryAfterMs).toBe(30000);
  });

  it("defaults RateLimitError.retryAfterMs when no Retry-After header is present", async () => {
    mswServer.use(
      http.get(`${BASE}/act_123/campaigns`, () =>
        HttpResponse.json({ error: { message: "rate limited" } }, { status: 429 }),
      ),
    );
    const client = new MetaApiClient();
    const error = unwrapErr(await client.getCampaigns("act_123", "TOKEN", "last_30d"));
    expect((error as RateLimitError).retryAfterMs).toBe(60000);
  });

  it("maps HTTP 429 to RateLimitError, reading Retry-After as an HTTP-date into retryAfterMs", async () => {
    const futureDate = new Date(Date.now() + 45_000).toUTCString();
    mswServer.use(
      http.get(`${BASE}/act_123/campaigns`, () =>
        HttpResponse.json(
          { error: { message: "rate limited" } },
          { status: 429, headers: { "retry-after": futureDate } },
        ),
      ),
    );
    const client = new MetaApiClient();
    const error = unwrapErr(await client.getCampaigns("act_123", "TOKEN", "last_30d"));
    expect(error).toBeInstanceOf(RateLimitError);
    // Allow generous slack for HTTP-date (1s resolution) round-tripping and test execution time.
    expect((error as RateLimitError).retryAfterMs).toBeGreaterThan(30_000);
    expect((error as RateLimitError).retryAfterMs).toBeLessThanOrEqual(46_000);
  });

  it("defaults RateLimitError.retryAfterMs when Retry-After is neither a number nor a valid HTTP-date", async () => {
    mswServer.use(
      http.get(`${BASE}/act_123/campaigns`, () =>
        HttpResponse.json(
          { error: { message: "rate limited" } },
          { status: 429, headers: { "retry-after": "not-a-date-or-number" } },
        ),
      ),
    );
    const client = new MetaApiClient();
    const error = unwrapErr(await client.getCampaigns("act_123", "TOKEN", "last_30d"));
    expect((error as RateLimitError).retryAfterMs).toBe(60000);
  });

  it("maps HTTP 401 without a Meta error code to AuthError", async () => {
    mswServer.use(
      http.get(`${BASE}/act_123/campaigns`, () => new HttpResponse(null, { status: 401 })),
    );
    const client = new MetaApiClient();
    expect(unwrapErr(await client.getCampaigns("act_123", "TOKEN", "last_30d"))).toBeInstanceOf(
      AuthError,
    );
  });

  it("maps HTTP 403 without a Meta error code to PermissionError", async () => {
    mswServer.use(
      http.get(`${BASE}/act_123/campaigns`, () => new HttpResponse(null, { status: 403 })),
    );
    const client = new MetaApiClient();
    expect(unwrapErr(await client.getCampaigns("act_123", "TOKEN", "last_30d"))).toBeInstanceOf(
      PermissionError,
    );
  });

  it("maps HTTP 500 to ApiServerError", async () => {
    mswServer.use(
      http.get(`${BASE}/act_123/campaigns`, () => new HttpResponse(null, { status: 500 })),
    );
    const client = new MetaApiClient();
    expect(unwrapErr(await client.getCampaigns("act_123", "TOKEN", "last_30d"))).toBeInstanceOf(
      ApiServerError,
    );
  });

  it("maps HTTP 503 to ApiServerError", async () => {
    mswServer.use(
      http.get(`${BASE}/act_123/campaigns`, () => new HttpResponse(null, { status: 503 })),
    );
    const client = new MetaApiClient();
    expect(unwrapErr(await client.getCampaigns("act_123", "TOKEN", "last_30d"))).toBeInstanceOf(
      ApiServerError,
    );
  });

  it("maps a non-JSON error body to a generic MetaApiError with the HTTP status", async () => {
    mswServer.use(
      http.get(`${BASE}/act_123/campaigns`, () => new HttpResponse("not json", { status: 418 })),
    );
    const client = new MetaApiClient();
    const error = unwrapErr(await client.getCampaigns("act_123", "TOKEN", "last_30d"));
    expect(error.httpStatus).toBe(418);
  });

  it("maps a network failure (no response at all) to ApiServerError", async () => {
    mswServer.use(http.get(`${BASE}/act_123/campaigns`, () => HttpResponse.error()));
    const client = new MetaApiClient();
    expect(unwrapErr(await client.getCampaigns("act_123", "TOKEN", "last_30d"))).toBeInstanceOf(
      ApiServerError,
    );
  });

  it("stringifies a non-Error thrown value when the fetch implementation itself throws a non-Error", async () => {
    // `fetch` (and any injected `fetchImpl`) is only contractually documented to reject with an
    // Error, but `describeCause`'s defensive `cause instanceof Error ? ... : String(cause)`
    // handles any thrown value — exercised directly here via a fetchImpl that throws a bare string.
    const throwingFetch: typeof fetch = () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw "raw non-error network throw";
    };
    const client = new MetaApiClient({ fetchImpl: throwingFetch });
    const error = unwrapErr(await client.getCampaigns("act_123", "TOKEN", "last_30d"));
    expect(error).toBeInstanceOf(ApiServerError);
    expect(error.message).toMatch(/raw non-error network throw/);
  });

  it("maps a response that fails Zod schema validation to ApiServerError", async () => {
    mswServer.use(
      http.get(`${BASE}/act_123/campaigns`, () => HttpResponse.json({ not: "the right shape" })),
    );
    const client = new MetaApiClient();
    expect(unwrapErr(await client.getCampaigns("act_123", "TOKEN", "last_30d"))).toBeInstanceOf(
      ApiServerError,
    );
  });

  it("maps a non-JSON success body to ApiServerError", async () => {
    mswServer.use(
      http.get(`${BASE}/act_123/campaigns`, () => new HttpResponse("not json", { status: 200 })),
    );
    const client = new MetaApiClient();
    expect(unwrapErr(await client.getCampaigns("act_123", "TOKEN", "last_30d"))).toBeInstanceOf(
      ApiServerError,
    );
  });

  it("aborts the request past the configured timeoutMs", async () => {
    mswServer.use(
      http.get(`${BASE}/act_123/campaigns`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json({ data: [] });
      }),
    );
    const client = new MetaApiClient({ timeoutMs: 5 });
    const result = await client.getCampaigns("act_123", "TOKEN", "last_30d");
    expect(result.ok).toBe(false);
  });
});

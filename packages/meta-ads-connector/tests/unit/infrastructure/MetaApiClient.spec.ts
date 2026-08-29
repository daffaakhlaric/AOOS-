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

  it("getAdAccount() parses a valid { id, name } response", async () => {
    mswServer.use(
      http.get(`${BASE}/act_555`, () => HttpResponse.json({ id: "act_555", name: "DSS Motor" })),
    );
    const client = new MetaApiClient();
    const result = await client.getAdAccount("act_555", "TOKEN");
    expect(unwrap(result)).toEqual({ id: "act_555", name: "DSS Motor" });
  });

  it("getAdAccount() returns an err Result when Meta rejects the lookup", async () => {
    mswServer.use(
      http.get(`${BASE}/act_bad`, () =>
        HttpResponse.json(
          { error: { message: "Invalid OAuth access token", type: "OAuthException", code: 190 } },
          { status: 401 },
        ),
      ),
    );
    const client = new MetaApiClient();
    const result = await client.getAdAccount("act_bad", "TOKEN");
    expect(unwrapErr(result)).toBeInstanceOf(AuthError);
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

  it("createCampaign() POSTs objective=OUTCOME_LEADS, status=PAUSED and parses the new id (AAOS-W1D-S3)", async () => {
    let capturedBody: unknown;
    mswServer.use(
      http.post(`${BASE}/act_123/campaigns`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: "new-campaign-1" });
      }),
    );
    const client = new MetaApiClient();
    const result = await client.createCampaign(
      "act_123",
      {
        name: "Meta-CTWA-Leads-Mobix-Cinere",
        objective: "OUTCOME_LEADS",
        specialAdCategories: [],
        status: "PAUSED",
      },
      "TOKEN",
    );
    expect(unwrap(result).id).toBe("new-campaign-1");
    expect(capturedBody).toEqual({
      name: "Meta-CTWA-Leads-Mobix-Cinere",
      objective: "OUTCOME_LEADS",
      special_ad_categories: [],
      status: "PAUSED",
      access_token: "TOKEN",
    });
  });

  it("createAdSet() POSTs destination_type=WHATSAPP, optimization_goal=LEAD_GENERATION, status=PAUSED and parses the new id (AAOS-W1D-S3)", async () => {
    let capturedBody: unknown;
    mswServer.use(
      http.post(`${BASE}/act_123/adsets`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: "new-adset-1" });
      }),
    );
    const client = new MetaApiClient();
    const result = await client.createAdSet(
      "act_123",
      {
        campaignId: "new-campaign-1",
        name: "Meta-CTWA-Leads-Mobix-Cinere-adset",
        destinationType: "WHATSAPP",
        optimizationGoal: "LEAD_GENERATION",
        billingEvent: "IMPRESSIONS",
        dailyBudgetCents: 10_000_000,
        status: "PAUSED",
      },
      "TOKEN",
    );
    expect(unwrap(result).id).toBe("new-adset-1");
    expect(capturedBody).toEqual({
      campaign_id: "new-campaign-1",
      name: "Meta-CTWA-Leads-Mobix-Cinere-adset",
      destination_type: "WHATSAPP",
      optimization_goal: "LEAD_GENERATION",
      billing_event: "IMPRESSIONS",
      daily_budget: 10_000_000,
      status: "PAUSED",
      access_token: "TOKEN",
    });
  });

  it("pauseCampaign() POSTs status=PAUSED to {campaign-id} and parses a success response (AAOS-GO-LIVE)", async () => {
    let capturedBody: unknown;
    mswServer.use(
      http.post(`${BASE}/campaign-1`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ success: true });
      }),
    );
    const client = new MetaApiClient();
    const result = await client.pauseCampaign("campaign-1", "TOKEN");
    expect(unwrap(result).success).toBe(true);
    expect(capturedBody).toEqual({ status: "PAUSED", access_token: "TOKEN" });
  });

  it("activateCampaign() POSTs status=ACTIVE to {campaign-id} and parses a success response (AAOS-GO-LIVE)", async () => {
    let capturedBody: unknown;
    mswServer.use(
      http.post(`${BASE}/campaign-1`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ success: true });
      }),
    );
    const client = new MetaApiClient();
    const result = await client.activateCampaign("campaign-1", "TOKEN");
    expect(unwrap(result).success).toBe(true);
    expect(capturedBody).toEqual({ status: "ACTIVE", access_token: "TOKEN" });
  });

  it("activateAd() POSTs status=ACTIVE to {ad-id} and parses a success response (AAOS-GO-LIVE)", async () => {
    let capturedBody: unknown;
    mswServer.use(
      http.post(`${BASE}/ad-1`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ success: true });
      }),
    );
    const client = new MetaApiClient();
    const result = await client.activateAd("ad-1", "TOKEN");
    expect(unwrap(result).success).toBe(true);
    expect(capturedBody).toEqual({ status: "ACTIVE", access_token: "TOKEN" });
  });

  it("createAd() POSTs a video creative's object_story_spec.video_data and parses the new id (AAOS-GO-LIVE)", async () => {
    let capturedBody: unknown;
    mswServer.use(
      http.post(`${BASE}/act_123/ads`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: "new-ad-1" });
      }),
    );
    const client = new MetaApiClient();
    const result = await client.createAd(
      "act_123",
      {
        adSetId: "adset-1",
        name: "Meta-CTWA-Leads-Mobix-Cinere-ad",
        pageId: "page-1",
        creative: {
          kind: "VIDEO",
          videoId: "video-1",
          thumbnailUrl: "https://storage.googleapis.com/aaos/thumb.jpg",
          message: "Promo motor bekas!",
          callToActionType: "WHATSAPP_MESSAGE",
        },
        status: "ACTIVE",
      },
      "TOKEN",
    );
    expect(unwrap(result).id).toBe("new-ad-1");
    expect(capturedBody).toEqual({
      adset_id: "adset-1",
      name: "Meta-CTWA-Leads-Mobix-Cinere-ad",
      creative: {
        object_story_spec: {
          page_id: "page-1",
          video_data: {
            video_id: "video-1",
            image_url: "https://storage.googleapis.com/aaos/thumb.jpg",
            message: "Promo motor bekas!",
            call_to_action: { type: "WHATSAPP_MESSAGE" },
          },
        },
      },
      status: "ACTIVE",
      access_token: "TOKEN",
    });
  });

  it("createAd() POSTs an image creative's object_story_spec.link_data and parses the new id (AAOS-GO-LIVE)", async () => {
    let capturedBody: unknown;
    mswServer.use(
      http.post(`${BASE}/act_123/ads`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: "new-ad-2" });
      }),
    );
    const client = new MetaApiClient();
    const result = await client.createAd(
      "act_123",
      {
        adSetId: "adset-1",
        name: "Image Ad",
        pageId: "page-1",
        creative: {
          kind: "IMAGE",
          imageHash: "hash-abc",
          linkUrl: "https://wa.me/6281234567890",
          message: "Rumah dijual",
          callToActionType: "WHATSAPP_MESSAGE",
        },
        status: "ACTIVE",
      },
      "TOKEN",
    );
    expect(unwrap(result).id).toBe("new-ad-2");
    expect(capturedBody).toEqual({
      adset_id: "adset-1",
      name: "Image Ad",
      creative: {
        object_story_spec: {
          page_id: "page-1",
          link_data: {
            image_hash: "hash-abc",
            link: "https://wa.me/6281234567890",
            message: "Rumah dijual",
            call_to_action: { type: "WHATSAPP_MESSAGE" },
          },
        },
      },
      status: "ACTIVE",
      access_token: "TOKEN",
    });
  });

  it("createAd() returns an err Result when Meta rejects ad creation", async () => {
    mswServer.use(
      http.post(`${BASE}/act_123/ads`, () =>
        HttpResponse.json({ error: { message: "invalid creative", code: 100 } }, { status: 400 }),
      ),
    );
    const client = new MetaApiClient();
    const result = await client.createAd(
      "act_123",
      {
        adSetId: "adset-1",
        name: "Will Fail",
        pageId: "page-1",
        creative: {
          kind: "IMAGE",
          imageHash: "hash-abc",
          linkUrl: "https://wa.me/6281234567890",
          message: "Rumah dijual",
          callToActionType: "WHATSAPP_MESSAGE",
        },
        status: "ACTIVE",
      },
      "TOKEN",
    );
    expect(result.ok).toBe(false);
  });

  it("uploadVideo() POSTs file_url to {ad-account}/advideos and parses the returned id (AAOS-GO-LIVE)", async () => {
    let capturedBody: unknown;
    mswServer.use(
      http.post(`${BASE}/act_123/advideos`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: "video-1" });
      }),
    );
    const client = new MetaApiClient();
    const result = await client.uploadVideo(
      "act_123",
      "https://storage.googleapis.com/aaos/creative.mp4",
      "TOKEN",
    );
    expect(unwrap(result).id).toBe("video-1");
    expect(capturedBody).toEqual({
      file_url: "https://storage.googleapis.com/aaos/creative.mp4",
      access_token: "TOKEN",
    });
  });

  it("uploadVideo() returns an err Result when Meta rejects the upload", async () => {
    mswServer.use(
      http.post(`${BASE}/act_123/advideos`, () =>
        HttpResponse.json({ error: { message: "bad video url", code: 100 } }, { status: 400 }),
      ),
    );
    const client = new MetaApiClient();
    const result = await client.uploadVideo("act_123", "https://bad-url", "TOKEN");
    expect(result.ok).toBe(false);
  });

  it("uploadImage() POSTs url to {ad-account}/adimages and parses the returned images map (AAOS-GO-LIVE)", async () => {
    let capturedBody: unknown;
    mswServer.use(
      http.post(`${BASE}/act_123/adimages`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          images: {
            "https://storage.googleapis.com/aaos/creative.jpg": {
              hash: "hash-abc",
              url: "https://storage.googleapis.com/aaos/creative.jpg",
            },
          },
        });
      }),
    );
    const client = new MetaApiClient();
    const result = await client.uploadImage(
      "act_123",
      "https://storage.googleapis.com/aaos/creative.jpg",
      "TOKEN",
    );
    expect(unwrap(result).images["https://storage.googleapis.com/aaos/creative.jpg"]?.hash).toBe(
      "hash-abc",
    );
    expect(capturedBody).toEqual({
      url: "https://storage.googleapis.com/aaos/creative.jpg",
      access_token: "TOKEN",
    });
  });

  it("uploadImage() returns an err Result when Meta rejects the upload", async () => {
    mswServer.use(
      http.post(`${BASE}/act_123/adimages`, () =>
        HttpResponse.json({ error: { message: "bad image url", code: 100 } }, { status: 400 }),
      ),
    );
    const client = new MetaApiClient();
    const result = await client.uploadImage("act_123", "https://bad-url", "TOKEN");
    expect(result.ok).toBe(false);
  });

  it("createCustomAudience() POSTs subtype=CUSTOM and parses the new id (AAOS-ABTESTING-LOOKALIKE Part 2)", async () => {
    let capturedBody: unknown;
    mswServer.use(
      http.post(`${BASE}/act_123/customaudiences`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: "audience-1" });
      }),
    );
    const client = new MetaApiClient();
    const result = await client.createCustomAudience(
      "act_123",
      {
        name: "AAOS-HotLeads-DSS-Motor-Aug26",
        subtype: "CUSTOM",
        description: "Hot leads dari AAOS Clara AI (score >= 65)",
        customerFileSource: "USER_PROVIDED_ONLY",
      },
      "TOKEN",
    );
    expect(unwrap(result).id).toBe("audience-1");
    expect(capturedBody).toEqual({
      name: "AAOS-HotLeads-DSS-Motor-Aug26",
      subtype: "CUSTOM",
      description: "Hot leads dari AAOS Clara AI (score >= 65)",
      customer_file_source: "USER_PROVIDED_ONLY",
      access_token: "TOKEN",
    });
  });

  it("createCustomAudience() returns an err Result when Meta rejects the create", async () => {
    mswServer.use(
      http.post(`${BASE}/act_123/customaudiences`, () =>
        HttpResponse.json({ error: { message: "invalid params", code: 100 } }, { status: 400 }),
      ),
    );
    const client = new MetaApiClient();
    const result = await client.createCustomAudience(
      "act_123",
      { name: "Fail", subtype: "CUSTOM", customerFileSource: "USER_PROVIDED_ONLY" },
      "TOKEN",
    );
    expect(result.ok).toBe(false);
  });

  it('addUsersToCustomAudience() POSTs payload.schema=["PHONE"] with hashed phones (AAOS-ABTESTING-LOOKALIKE Part 2)', async () => {
    let capturedBody: unknown;
    mswServer.use(
      http.post(`${BASE}/audience-1/users`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ session_id: 9778993, num_received: 2, num_invalid_entries: 0 });
      }),
    );
    const client = new MetaApiClient();
    const result = await client.addUsersToCustomAudience(
      "audience-1",
      { hashedPhones: ["hash-a", "hash-b"] },
      "TOKEN",
    );
    expect(unwrap(result).num_received).toBe(2);
    expect(capturedBody).toEqual({
      payload: { schema: ["PHONE"], data: [["hash-a"], ["hash-b"]] },
      access_token: "TOKEN",
    });
  });

  it("addUsersToCustomAudience() returns an err Result when Meta rejects the upload", async () => {
    mswServer.use(
      http.post(`${BASE}/audience-1/users`, () =>
        HttpResponse.json({ error: { message: "invalid payload", code: 100 } }, { status: 400 }),
      ),
    );
    const client = new MetaApiClient();
    const result = await client.addUsersToCustomAudience(
      "audience-1",
      { hashedPhones: ["hash-a"] },
      "TOKEN",
    );
    expect(result.ok).toBe(false);
  });

  it("createLookalikeAudience() POSTs subtype=LOOKALIKE with a stringified lookalike_spec and parses the new id (AAOS-ABTESTING-LOOKALIKE Part 2)", async () => {
    let capturedBody: Record<string, unknown> = {};
    mswServer.use(
      http.post(`${BASE}/act_123/customaudiences`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "lookalike-1" });
      }),
    );
    const client = new MetaApiClient();
    const result = await client.createLookalikeAudience(
      "act_123",
      {
        name: "AAOS-Lookalike-1pct-DSS-Motor",
        originAudienceId: "audience-1",
        ratio: 0.01,
        country: "ID",
      },
      "TOKEN",
    );
    expect(unwrap(result).id).toBe("lookalike-1");
    expect(capturedBody).toEqual({
      name: "AAOS-Lookalike-1pct-DSS-Motor",
      subtype: "LOOKALIKE",
      origin_audience_id: "audience-1",
      lookalike_spec: JSON.stringify({ type: "similarity", ratio: 0.01, country: "ID" }),
      access_token: "TOKEN",
    });
  });

  it("createLookalikeAudience() returns an err Result when Meta rejects the create", async () => {
    mswServer.use(
      http.post(`${BASE}/act_123/customaudiences`, () =>
        HttpResponse.json(
          { error: { message: "seed audience too small", code: 100 } },
          { status: 400 },
        ),
      ),
    );
    const client = new MetaApiClient();
    const result = await client.createLookalikeAudience(
      "act_123",
      { name: "Fail", originAudienceId: "audience-1", ratio: 0.01, country: "ID" },
      "TOKEN",
    );
    expect(result.ok).toBe(false);
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

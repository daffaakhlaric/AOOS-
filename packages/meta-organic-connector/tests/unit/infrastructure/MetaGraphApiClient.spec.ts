import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  ApiServerError,
  AuthError,
  PermissionError,
  RateLimitError,
} from "../../../src/domain/errors/index.js";
import { MetaGraphApiClient } from "../../../src/infrastructure/meta-api/MetaGraphApiClient.js";
import { mswServer } from "../../helpers/msw.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const BASE = "https://graph.facebook.com/v21.0";

describe("MetaGraphApiClient", () => {
  it("publishFacebookPost() POSTs message+link and parses { id }", async () => {
    let capturedBody: unknown;
    mswServer.use(
      http.post(`${BASE}/page-1/feed`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: "page-1_post-1" });
      }),
    );
    const client = new MetaGraphApiClient();
    const result = await client.publishFacebookPost(
      { pageId: "page-1", message: "Hello", link: "https://example.com/unit" },
      "TOKEN",
    );
    expect(unwrap(result).id).toBe("page-1_post-1");
    expect(capturedBody).toEqual({
      message: "Hello",
      link: "https://example.com/unit",
      access_token: "TOKEN",
    });
  });

  it("publishFacebookPost() omits link when not supplied", async () => {
    let capturedBody: unknown;
    mswServer.use(
      http.post(`${BASE}/page-1/feed`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: "page-1_post-2" });
      }),
    );
    const client = new MetaGraphApiClient();
    await client.publishFacebookPost({ pageId: "page-1", message: "No link" }, "TOKEN");
    expect(capturedBody).toEqual({ message: "No link", access_token: "TOKEN" });
  });

  it("createInstagramMediaContainer() POSTs image_url+caption for an IMAGE spec and parses { id }", async () => {
    let capturedBody: unknown;
    mswServer.use(
      http.post(`${BASE}/ig-1/media`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: "container-1" });
      }),
    );
    const client = new MetaGraphApiClient();
    const result = await client.createInstagramMediaContainer(
      {
        igUserId: "ig-1",
        media: { kind: "IMAGE", imageUrl: "https://gcs.example/unit.jpg" },
        caption: "Xpander Cross DP 29jt",
      },
      "TOKEN",
    );
    expect(unwrap(result).id).toBe("container-1");
    expect(capturedBody).toEqual({
      image_url: "https://gcs.example/unit.jpg",
      caption: "Xpander Cross DP 29jt",
      access_token: "TOKEN",
    });
  });

  it("createInstagramMediaContainer() POSTs video_url+media_type for a VIDEO spec", async () => {
    let capturedBody: unknown;
    mswServer.use(
      http.post(`${BASE}/ig-1/media`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: "container-2" });
      }),
    );
    const client = new MetaGraphApiClient();
    await client.createInstagramMediaContainer(
      { igUserId: "ig-1", media: { kind: "REELS", videoUrl: "https://gcs.example/unit.mp4" } },
      "TOKEN",
    );
    expect(capturedBody).toEqual({
      video_url: "https://gcs.example/unit.mp4",
      media_type: "REELS",
      access_token: "TOKEN",
    });
  });

  it("createInstagramMediaContainer() returns the error Result when the POST fails", async () => {
    mswServer.use(http.post(`${BASE}/ig-bad/media`, () => new HttpResponse(null, { status: 500 })));
    const client = new MetaGraphApiClient();
    const result = await client.createInstagramMediaContainer(
      { igUserId: "ig-bad", media: { kind: "IMAGE", imageUrl: "https://gcs.example/x.jpg" } },
      "TOKEN",
    );
    expect(unwrapErr(result)).toBeInstanceOf(ApiServerError);
  });

  it("publishInstagramMedia() returns the error Result when the POST fails", async () => {
    mswServer.use(
      http.post(`${BASE}/ig-bad/media_publish`, () => new HttpResponse(null, { status: 500 })),
    );
    const client = new MetaGraphApiClient();
    const result = await client.publishInstagramMedia(
      { igUserId: "ig-bad", creationId: "container-x" },
      "TOKEN",
    );
    expect(unwrapErr(result)).toBeInstanceOf(ApiServerError);
  });

  it("publishInstagramMedia() POSTs creation_id and parses { id }", async () => {
    let capturedBody: unknown;
    mswServer.use(
      http.post(`${BASE}/ig-1/media_publish`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: "media-1" });
      }),
    );
    const client = new MetaGraphApiClient();
    const result = await client.publishInstagramMedia(
      { igUserId: "ig-1", creationId: "container-1" },
      "TOKEN",
    );
    expect(unwrap(result).id).toBe("media-1");
    expect(capturedBody).toEqual({ creation_id: "container-1", access_token: "TOKEN" });
  });

  it("getPagePostInsights() GETs with a metric query param and parses { data }", async () => {
    let capturedUrl: URL | undefined;
    mswServer.use(
      http.get(`${BASE}/page-1_post-1/insights`, ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json({
          data: [
            {
              name: "post_impressions",
              period: "lifetime",
              values: [{ value: 1204 }],
            },
          ],
        });
      }),
    );
    const client = new MetaGraphApiClient();
    const result = await client.getPagePostInsights(
      "page-1_post-1",
      ["post_impressions", "post_impressions_unique"],
      "TOKEN",
    );
    expect(unwrap(result).data[0]?.name).toBe("post_impressions");
    expect(capturedUrl?.searchParams.get("metric")).toBe(
      "post_impressions,post_impressions_unique",
    );
    expect(capturedUrl?.searchParams.get("access_token")).toBe("TOKEN");
  });

  it("getInstagramMediaInsights() GETs with a metric query param and parses { data }", async () => {
    mswServer.use(
      http.get(`${BASE}/media-1/insights`, () =>
        HttpResponse.json({
          data: [{ name: "reach", period: "lifetime", values: [{ value: 842 }] }],
        }),
      ),
    );
    const client = new MetaGraphApiClient();
    const result = await client.getInstagramMediaInsights("media-1", ["reach"], "TOKEN");
    expect(unwrap(result).data[0]?.name).toBe("reach");
  });

  it("getPagePostInsights() returns the error Result when the GET fails", async () => {
    mswServer.use(
      http.get(`${BASE}/page-1_post-bad/insights`, () => new HttpResponse(null, { status: 500 })),
    );
    const client = new MetaGraphApiClient();
    const result = await client.getPagePostInsights(
      "page-1_post-bad",
      ["post_impressions"],
      "TOKEN",
    );
    expect(unwrapErr(result)).toBeInstanceOf(ApiServerError);
  });

  it("maps Meta error code 190 to AuthError regardless of HTTP status", async () => {
    mswServer.use(
      http.post(`${BASE}/page-bad/feed`, () =>
        HttpResponse.json(
          { error: { message: "Invalid OAuth access token", type: "OAuthException", code: 190 } },
          { status: 400 },
        ),
      ),
    );
    const client = new MetaGraphApiClient();
    const result = await client.publishFacebookPost({ pageId: "page-bad", message: "x" }, "TOKEN");
    expect(unwrapErr(result)).toBeInstanceOf(AuthError);
  });

  it("maps Meta error code 200 to PermissionError", async () => {
    mswServer.use(
      http.post(`${BASE}/page-bad/feed`, () =>
        HttpResponse.json(
          {
            error: {
              message: "Missing pages_manage_posts permission",
              type: "OAuthException",
              code: 200,
            },
          },
          { status: 403 },
        ),
      ),
    );
    const client = new MetaGraphApiClient();
    const result = await client.publishFacebookPost({ pageId: "page-bad", message: "x" }, "TOKEN");
    expect(unwrapErr(result)).toBeInstanceOf(PermissionError);
  });

  it("maps HTTP 401 (no recognized Meta error code) to AuthError", async () => {
    mswServer.use(
      http.post(`${BASE}/page-bad/feed`, () => new HttpResponse(null, { status: 401 })),
    );
    const client = new MetaGraphApiClient();
    const result = await client.publishFacebookPost({ pageId: "page-bad", message: "x" }, "TOKEN");
    expect(unwrapErr(result)).toBeInstanceOf(AuthError);
  });

  it("maps HTTP 403 (no recognized Meta error code) to PermissionError", async () => {
    mswServer.use(
      http.post(`${BASE}/page-bad/feed`, () => new HttpResponse(null, { status: 403 })),
    );
    const client = new MetaGraphApiClient();
    const result = await client.publishFacebookPost({ pageId: "page-bad", message: "x" }, "TOKEN");
    expect(unwrapErr(result)).toBeInstanceOf(PermissionError);
  });

  it("maps HTTP 429 with a numeric retry-after header to RateLimitError", async () => {
    mswServer.use(
      http.post(`${BASE}/page-bad/feed`, () =>
        HttpResponse.json(
          { error: { message: "Rate limited" } },
          {
            status: 429,
            headers: { "retry-after": "30" },
          },
        ),
      ),
    );
    const client = new MetaGraphApiClient();
    const result = await client.publishFacebookPost({ pageId: "page-bad", message: "x" }, "TOKEN");
    const error = unwrapErr(result);
    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).retryAfterMs).toBe(30_000);
  });

  it("maps HTTP 429 with no retry-after header to a default 60s RateLimitError", async () => {
    mswServer.use(
      http.post(`${BASE}/page-bad/feed`, () =>
        HttpResponse.json({ error: { message: "Rate limited" } }, { status: 429 }),
      ),
    );
    const client = new MetaGraphApiClient();
    const result = await client.publishFacebookPost({ pageId: "page-bad", message: "x" }, "TOKEN");
    const error = unwrapErr(result);
    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).retryAfterMs).toBe(60_000);
  });

  it("maps HTTP 429 with a date-formatted retry-after header to RateLimitError", async () => {
    const future = new Date(Date.now() + 45_000).toUTCString();
    mswServer.use(
      http.post(`${BASE}/page-bad/feed`, () =>
        HttpResponse.json(
          { error: { message: "Rate limited" } },
          {
            status: 429,
            headers: { "retry-after": future },
          },
        ),
      ),
    );
    const client = new MetaGraphApiClient();
    const result = await client.publishFacebookPost({ pageId: "page-bad", message: "x" }, "TOKEN");
    const error = unwrapErr(result);
    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).retryAfterMs).toBeGreaterThan(0);
  });

  it("maps HTTP 429 with an unparseable retry-after header to a default 60s RateLimitError", async () => {
    mswServer.use(
      http.post(`${BASE}/page-bad/feed`, () =>
        HttpResponse.json(
          { error: { message: "Rate limited" } },
          {
            status: 429,
            headers: { "retry-after": "not-a-number-or-date" },
          },
        ),
      ),
    );
    const client = new MetaGraphApiClient();
    const result = await client.publishFacebookPost({ pageId: "page-bad", message: "x" }, "TOKEN");
    const error = unwrapErr(result);
    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).retryAfterMs).toBe(60_000);
  });

  it("maps HTTP 500 to a retryable ApiServerError", async () => {
    mswServer.use(
      http.post(`${BASE}/page-bad/feed`, () => new HttpResponse(null, { status: 500 })),
    );
    const client = new MetaGraphApiClient();
    const result = await client.publishFacebookPost({ pageId: "page-bad", message: "x" }, "TOKEN");
    expect(unwrapErr(result)).toBeInstanceOf(ApiServerError);
  });

  it("maps an unrecognized HTTP status to the generic MetaGraphApiError", async () => {
    mswServer.use(
      http.post(`${BASE}/page-bad/feed`, () => new HttpResponse(null, { status: 418 })),
    );
    const client = new MetaGraphApiClient();
    const result = await client.publishFacebookPost({ pageId: "page-bad", message: "x" }, "TOKEN");
    expect(result.ok).toBe(false);
  });

  it("maps a non-JSON error body to a generic HTTP-status message", async () => {
    mswServer.use(
      http.post(`${BASE}/page-bad/feed`, () => new HttpResponse("not json", { status: 500 })),
    );
    const client = new MetaGraphApiClient();
    const result = await client.publishFacebookPost({ pageId: "page-bad", message: "x" }, "TOKEN");
    const error = unwrapErr(result);
    expect(error).toBeInstanceOf(ApiServerError);
    expect(error.message).toContain("HTTP 500");
  });

  it("maps a non-JSON success body to ApiServerError", async () => {
    mswServer.use(
      http.post(`${BASE}/page-1/feed`, () => new HttpResponse("not json", { status: 200 })),
    );
    const client = new MetaGraphApiClient();
    const result = await client.publishFacebookPost({ pageId: "page-1", message: "x" }, "TOKEN");
    expect(unwrapErr(result)).toBeInstanceOf(ApiServerError);
  });

  it("maps a success body that fails schema validation to ApiServerError", async () => {
    mswServer.use(http.post(`${BASE}/page-1/feed`, () => HttpResponse.json({ notAnId: true })));
    const client = new MetaGraphApiClient();
    const result = await client.publishFacebookPost({ pageId: "page-1", message: "x" }, "TOKEN");
    expect(unwrapErr(result)).toBeInstanceOf(ApiServerError);
  });

  it("maps a network failure (fetch throws) to a retryable ApiServerError", async () => {
    const failingFetch: typeof fetch = () => Promise.reject(new Error("ECONNRESET"));
    const client = new MetaGraphApiClient({ fetchImpl: failingFetch });
    const result = await client.publishFacebookPost({ pageId: "page-1", message: "x" }, "TOKEN");
    const error = unwrapErr(result);
    expect(error).toBeInstanceOf(ApiServerError);
    expect(error.message).toContain("ECONNRESET");
  });

  it("maps a non-Error network failure to a stringified message", async () => {
    const failingFetch: typeof fetch = () => Promise.reject("plain string failure");
    const client = new MetaGraphApiClient({ fetchImpl: failingFetch });
    const result = await client.publishFacebookPost({ pageId: "page-1", message: "x" }, "TOKEN");
    const error = unwrapErr(result);
    expect(error.message).toContain("plain string failure");
  });
});

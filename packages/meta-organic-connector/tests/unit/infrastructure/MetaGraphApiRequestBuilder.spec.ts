import { describe, expect, it } from "vitest";

import {
  IG_MEDIA_INSIGHTS_METRICS,
  MetaGraphApiRequestBuilder,
  PAGE_POST_INSIGHTS_METRICS,
} from "../../../src/infrastructure/meta-api/MetaGraphApiRequestBuilder.js";

const BASE = "https://graph.facebook.com/v21.0";

describe("MetaGraphApiRequestBuilder", () => {
  it("feedUrl() builds POST /{page-id}/feed", () => {
    expect(MetaGraphApiRequestBuilder.feedUrl("page-1")).toBe(`${BASE}/page-1/feed`);
  });

  it("mediaUrl() builds POST /{ig-user-id}/media", () => {
    expect(MetaGraphApiRequestBuilder.mediaUrl("ig-1")).toBe(`${BASE}/ig-1/media`);
  });

  it("mediaPublishUrl() builds POST /{ig-user-id}/media_publish", () => {
    expect(MetaGraphApiRequestBuilder.mediaPublishUrl("ig-1")).toBe(`${BASE}/ig-1/media_publish`);
  });

  it("insightsUrl() builds GET /{node}/insights with metric + access_token query params", () => {
    const url = new URL(
      MetaGraphApiRequestBuilder.insightsUrl("post-1", ["reach", "likes"], "TOKEN"),
    );
    expect(url.origin + url.pathname).toBe(`${BASE}/post-1/insights`);
    expect(url.searchParams.get("metric")).toBe("reach,likes");
    expect(url.searchParams.get("access_token")).toBe("TOKEN");
  });

  it("PAGE_POST_INSIGHTS_METRICS excludes deprecated post_engaged_users", () => {
    expect(PAGE_POST_INSIGHTS_METRICS).not.toContain("post_engaged_users");
    expect(PAGE_POST_INSIGHTS_METRICS).toContain("post_impressions");
  });

  it("IG_MEDIA_INSIGHTS_METRICS excludes deprecated impressions/video_views", () => {
    expect(IG_MEDIA_INSIGHTS_METRICS).not.toContain("impressions");
    expect(IG_MEDIA_INSIGHTS_METRICS).not.toContain("video_views");
    expect(IG_MEDIA_INSIGHTS_METRICS).toContain("reach");
  });
});

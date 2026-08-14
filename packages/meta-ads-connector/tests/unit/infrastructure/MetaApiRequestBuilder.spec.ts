import { describe, expect, it } from "vitest";

import { MetaApiRequestBuilder } from "../../../src/infrastructure/meta-api/MetaApiRequestBuilder.js";

const BASE = "https://graph.facebook.com/v21.0";

describe("MetaApiRequestBuilder", () => {
  it("builds the campaigns URL with the exact documented field list and limit=100", () => {
    const url = new URL(MetaApiRequestBuilder.campaignsUrl("act_123", "TOKEN", "last_30d"));
    expect(url.origin + url.pathname).toBe(`${BASE}/act_123/campaigns`);
    expect(url.searchParams.get("limit")).toBe("100");
    expect(url.searchParams.get("access_token")).toBe("TOKEN");
    const fields = url.searchParams.get("fields") ?? "";
    expect(fields).toContain("id,name,objective,status,created_time");
    expect(fields).toContain(
      "insights.date_preset(last_30d){spend,impressions,reach,frequency,clicks,actions}",
    );
  });

  it("builds the campaigns URL with an `after` cursor when provided", () => {
    const url = new URL(
      MetaApiRequestBuilder.campaignsUrl("act_123", "TOKEN", "last_7d", { after: "cursor-1" }),
    );
    expect(url.searchParams.get("after")).toBe("cursor-1");
  });

  it("omits `after` when no cursor is given", () => {
    const url = new URL(MetaApiRequestBuilder.campaignsUrl("act_123", "TOKEN", "last_7d"));
    expect(url.searchParams.has("after")).toBe(false);
  });

  it("builds the adsets URL scoped to a campaign id, with spend-only insights fixed at last_30d", () => {
    const url = new URL(MetaApiRequestBuilder.adSetsUrl("120000001", "TOKEN"));
    expect(url.origin + url.pathname).toBe(`${BASE}/120000001/adsets`);
    const fields = url.searchParams.get("fields") ?? "";
    expect(fields).toContain("id,name,status,daily_budget");
    expect(fields).toContain("insights.date_preset(last_30d){spend}");
  });

  it("builds the ads URL scoped to an adset id, honoring the given datePreset for insights", () => {
    const url = new URL(MetaApiRequestBuilder.adsUrl("120000002", "TOKEN", "last_14d"));
    expect(url.origin + url.pathname).toBe(`${BASE}/120000002/ads`);
    const fields = url.searchParams.get("fields") ?? "";
    expect(fields).toContain("id,name,status,created_time");
    expect(fields).toContain(
      "insights.date_preset(last_14d){spend,impressions,reach,frequency,clicks,actions}",
    );
  });

  it("builds the pause-ad action URL as {base}/{version}/{ad-id}", () => {
    expect(MetaApiRequestBuilder.pauseAdUrl("ad-1")).toBe(`${BASE}/ad-1`);
  });

  it("builds the scale-adset action URL as {base}/{version}/{adset-id}", () => {
    expect(MetaApiRequestBuilder.scaleAdSetUrl("adset-1")).toBe(`${BASE}/adset-1`);
  });

  it("builds the fix-campaign action URL as {base}/{version}/{campaign-id}", () => {
    expect(MetaApiRequestBuilder.fixCampaignUrl("campaign-1")).toBe(`${BASE}/campaign-1`);
  });

  it("URL-encodes an access token containing special characters", () => {
    const url = new URL(MetaApiRequestBuilder.campaignsUrl("act_123", "a b&c", "last_30d"));
    expect(url.searchParams.get("access_token")).toBe("a b&c");
  });

  it("builds the create-campaign action URL as {base}/{version}/{ad-account}/campaigns (AAOS-W1D-S3)", () => {
    expect(MetaApiRequestBuilder.createCampaignUrl("act_123")).toBe(`${BASE}/act_123/campaigns`);
  });

  it("builds the create-adset action URL as {base}/{version}/{ad-account}/adsets (AAOS-W1D-S3)", () => {
    expect(MetaApiRequestBuilder.createAdSetUrl("act_123")).toBe(`${BASE}/act_123/adsets`);
  });
});

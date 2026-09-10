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
    expect(fields).toContain("id,name,status,daily_budget,targeting");
    expect(fields).toContain("insights.date_preset(last_30d){spend}");
  });

  it("requests the adset's targeting spec as a bare field, not a nested-field-expansion (AAOS Analytics Platform Phase 3 — `targeting` is a plain JSON object field on the AdSet node, not an edge, unlike `creative` on Ad)", () => {
    const url = new URL(MetaApiRequestBuilder.adSetsUrl("120000001", "TOKEN"));
    const fields = url.searchParams.get("fields") ?? "";
    expect(fields).toContain(",targeting,");
    expect(fields).not.toContain("targeting{");
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

  it("requests the ad's creative asset ids via Meta's nested-field-expansion syntax (AAOS Analytics Platform Phase 2)", () => {
    const url = new URL(MetaApiRequestBuilder.adsUrl("120000002", "TOKEN", "last_14d"));
    const fields = url.searchParams.get("fields") ?? "";
    expect(fields).toContain("creative{image_hash,video_id");
    // exact field ordering matters for readability/diffability of the built URL, not correctness —
    // Meta's `fields` param is comma-separated and order-insensitive — but pin it anyway so a
    // future edit that silently drops the creative expansion fails this test loudly. Extended
    // (AAOS Samantha Professional Optimizer, Part B) with the real `object_story_spec.link_data`
    // ad-copy-text expansion — see `MetaApiRequestBuilder.ts`'s `AD_FIELDS` docstring.
    expect(fields).toContain(
      "id,name,status,created_time,creative{image_hash,video_id,object_story_spec{link_data{message,name,description}}}",
    );
  });

  it("builds the ad-account name-lookup URL requesting only the `name` field", () => {
    const url = new URL(MetaApiRequestBuilder.adAccountUrl("act_999", "TOKEN"));
    expect(url.origin + url.pathname).toBe(`${BASE}/act_999`);
    expect(url.searchParams.get("fields")).toBe("name");
    expect(url.searchParams.get("access_token")).toBe("TOKEN");
    expect(url.searchParams.has("limit")).toBe(false);
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

  it("builds the pause-campaign action URL as {base}/{version}/{campaign-id} (AAOS-GO-LIVE)", () => {
    expect(MetaApiRequestBuilder.pauseCampaignUrl("campaign-1")).toBe(`${BASE}/campaign-1`);
  });

  it("builds the activate-campaign action URL as {base}/{version}/{campaign-id} (AAOS-GO-LIVE)", () => {
    expect(MetaApiRequestBuilder.activateCampaignUrl("campaign-1")).toBe(`${BASE}/campaign-1`);
  });

  it("builds the activate-ad action URL as {base}/{version}/{ad-id} (AAOS-GO-LIVE)", () => {
    expect(MetaApiRequestBuilder.activateAdUrl("ad-1")).toBe(`${BASE}/ad-1`);
  });

  it("builds the create-ad action URL as {base}/{version}/{ad-account}/ads (AAOS-GO-LIVE)", () => {
    expect(MetaApiRequestBuilder.createAdUrl("act_123")).toBe(`${BASE}/act_123/ads`);
  });

  it("builds the upload-video action URL as {base}/{version}/{ad-account}/advideos (AAOS-GO-LIVE)", () => {
    expect(MetaApiRequestBuilder.uploadVideoUrl("act_123")).toBe(`${BASE}/act_123/advideos`);
  });

  it("builds the upload-image action URL as {base}/{version}/{ad-account}/adimages (AAOS-GO-LIVE)", () => {
    expect(MetaApiRequestBuilder.uploadImageUrl("act_123")).toBe(`${BASE}/act_123/adimages`);
  });

  it("builds the create-custom-audience URL as {base}/{version}/{ad-account}/customaudiences (AAOS-ABTESTING-LOOKALIKE Part 2)", () => {
    expect(MetaApiRequestBuilder.createCustomAudienceUrl("act_123")).toBe(
      `${BASE}/act_123/customaudiences`,
    );
  });

  it("builds the custom-audience-users URL as {base}/{version}/{custom-audience-id}/users (AAOS-ABTESTING-LOOKALIKE Part 2)", () => {
    expect(MetaApiRequestBuilder.customAudienceUsersUrl("audience-1")).toBe(
      `${BASE}/audience-1/users`,
    );
  });

  /**
   * N+1-fanout fix — the real field-expansion request shape `PullCampaignData` now issues instead
   * of the old campaigns-then-per-campaign-adsets-then-per-adset-ads fanout. Verified against
   * Meta's real, documented nested-field-expansion + `.limit(N)`-on-nested-edge grammar.
   */
  describe("campaignsExpandedUrl (N+1-fanout fix)", () => {
    it("requests the same top-level campaign fields/insights as the pre-existing campaignsUrl", () => {
      const url = new URL(
        MetaApiRequestBuilder.campaignsExpandedUrl("act_123", "TOKEN", "last_30d"),
      );
      expect(url.origin + url.pathname).toBe(`${BASE}/act_123/campaigns`);
      expect(url.searchParams.get("limit")).toBe("100");
      const fields = url.searchParams.get("fields") ?? "";
      expect(fields).toContain("id,name,objective,status,created_time");
      expect(fields).toContain(
        "insights.date_preset(last_30d){spend,impressions,reach,frequency,clicks,actions}",
      );
    });

    it("nests the adsets edge with a `.limit(N)` pagination modifier and its own spend-only last_30d insights", () => {
      const url = new URL(
        MetaApiRequestBuilder.campaignsExpandedUrl("act_123", "TOKEN", "last_30d"),
      );
      const fields = url.searchParams.get("fields") ?? "";
      expect(fields).toContain("adsets.limit(50){");
      expect(fields).toContain("id,name,status,daily_budget,targeting");
      expect(fields).toContain("insights.date_preset(last_30d){spend}");
    });

    it("nests the ads edge (inside adsets) with its own `.limit(N)`, creative expansion, and the CALLER's datePreset insights", () => {
      const url = new URL(MetaApiRequestBuilder.campaignsExpandedUrl("act_123", "TOKEN", "today"));
      const fields = url.searchParams.get("fields") ?? "";
      expect(fields).toContain("ads.limit(50){");
      expect(fields).toContain("creative{image_hash,video_id");
      // The nested ad-level insights window follows the caller's real requested datePreset
      // ("today" here), NOT hardcoded — matching the pre-existing adsUrl(datePreset) behavior.
      expect(fields).toContain(
        "insights.date_preset(today){spend,impressions,reach,frequency,clicks,actions}",
      );
      // ...while the nested adset-level insights window stays hardcoded last_30d, matching the
      // pre-existing adSetsUrl behavior exactly (unaffected by the top-level datePreset).
      expect(fields).toContain("insights.date_preset(last_30d){spend}");
    });

    it("accepts a custom nestedLimit override", () => {
      const url = new URL(
        MetaApiRequestBuilder.campaignsExpandedUrl("act_123", "TOKEN", "last_30d", undefined, 10),
      );
      const fields = url.searchParams.get("fields") ?? "";
      expect(fields).toContain("adsets.limit(10){");
      expect(fields).toContain("ads.limit(10){");
    });

    it("honors a pagination cursor exactly like campaignsUrl", () => {
      const url = new URL(
        MetaApiRequestBuilder.campaignsExpandedUrl("act_123", "TOKEN", "last_30d", {
          after: "cursor-1",
        }),
      );
      expect(url.searchParams.get("after")).toBe("cursor-1");
    });
  });
});

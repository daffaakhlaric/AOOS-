import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import {
  GrowthObjectiveCampaignsRepository,
  GrowthObjectiveCampaignsRepositoryError,
} from "./growth-objective-campaigns.repository.js";

const TENANT = "propertyklik-demo";

function seedCampaign(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "row-1",
    tenant_id: TENANT,
    meta_campaign_id: "meta-1",
    listing_id: null,
    ...overrides,
  };
}

describe("GrowthObjectiveCampaignsRepository", () => {
  describe("findCampaignIdsForListings", () => {
    it("returns [] WITHOUT querying when listingIds is empty", async () => {
      const client = createFakeSupabaseClient();
      // Force an error to prove the guard short-circuits before any query is issued.
      client.forceErrorOnce("meta_campaigns", "should never be hit");
      const repo = new GrowthObjectiveCampaignsRepository(client);
      const ids = await repo.findCampaignIdsForListings(TENANT, []);
      expect(ids).toEqual([]);
    });

    it("finds real meta_campaign_ids linked to any of the wanted listingIds", async () => {
      const client = createFakeSupabaseClient();
      client.seed(
        "meta_campaigns",
        seedCampaign({ id: "row-1", meta_campaign_id: "meta-1", listing_id: "listing-a" }),
      );
      client.seed(
        "meta_campaigns",
        seedCampaign({ id: "row-2", meta_campaign_id: "meta-2", listing_id: "listing-b" }),
      );
      // Unlinked campaign — never included.
      client.seed(
        "meta_campaigns",
        seedCampaign({ id: "row-3", meta_campaign_id: "meta-3", listing_id: null }),
      );
      // Linked to a listing nobody asked for — never included.
      client.seed(
        "meta_campaigns",
        seedCampaign({ id: "row-4", meta_campaign_id: "meta-4", listing_id: "listing-z" }),
      );
      // Different tenant, same listing_id — never included.
      client.seed(
        "meta_campaigns",
        seedCampaign({
          id: "row-5",
          tenant_id: "other",
          meta_campaign_id: "meta-5",
          listing_id: "listing-a",
        }),
      );

      const repo = new GrowthObjectiveCampaignsRepository(client);
      const ids = await repo.findCampaignIdsForListings(TENANT, ["listing-a", "listing-b"]);
      expect(ids.slice().sort()).toEqual(["meta-1", "meta-2"]);
    });

    it("returns [] when none of the tenant's synced campaigns match any wanted listing", async () => {
      const client = createFakeSupabaseClient();
      client.seed(
        "meta_campaigns",
        seedCampaign({ meta_campaign_id: "meta-1", listing_id: "listing-z" }),
      );
      const repo = new GrowthObjectiveCampaignsRepository(client);
      const ids = await repo.findCampaignIdsForListings(TENANT, ["listing-a"]);
      expect(ids).toEqual([]);
    });

    it("throws GrowthObjectiveCampaignsRepositoryError on a forced Supabase error", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("meta_campaigns", "boom");
      const repo = new GrowthObjectiveCampaignsRepository(client);
      await expect(repo.findCampaignIdsForListings(TENANT, ["listing-a"])).rejects.toThrow(
        GrowthObjectiveCampaignsRepositoryError,
      );
    });
  });
});

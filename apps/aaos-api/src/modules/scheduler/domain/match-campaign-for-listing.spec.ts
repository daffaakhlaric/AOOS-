import {
  AdBuilder,
  AdSetBuilder,
  AdStatus,
  CampaignBuilder,
  Verdict,
  type AdAccount,
} from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import type { ListingResponseDto } from "../../listings/dto/listing.dto.js";

import { matchActiveCampaignForListing } from "./match-campaign-for-listing.js";

function unwrap<T>(result: { ok: boolean; value?: T; error?: unknown }): T {
  if (!result.ok) {
    throw new Error(`unwrap failed: ${JSON.stringify(result.error)}`);
  }
  return result.value as T;
}

function buildAdAccount(
  overrides: { name?: string; status?: AdStatus; verdict?: Verdict } = {},
): AdAccount {
  const ad = unwrap(new AdBuilder().withVerdict(overrides.verdict ?? Verdict.KEEP).build());
  const adSet = unwrap(new AdSetBuilder().withAds([ad]).build());
  const campaign = unwrap(
    new CampaignBuilder()
      .withName(overrides.name ?? "BSD City Ready Huni")
      .withStatus(overrides.status ?? AdStatus.ACTIVE)
      .withAdSets([adSet])
      .build(),
  );
  return {
    id: campaign.adSets[0]?.adAccountId,
    name: "Test Ad Account",
    businessManagerId: "bm_1",
    currency: "IDR",
    timezone: "Asia/Jakarta",
    campaigns: [campaign],
    syncedAt: new Date("2026-08-18T00:00:00.000Z"),
  } as unknown as AdAccount;
}

function buildListing(overrides: Partial<ListingResponseDto> = {}): ListingResponseDto {
  return {
    id: "listing-1",
    title: "BSD City Ready Huni",
    propertyType: "HOUSE",
    listingStatus: "ACTIVE",
    price: 1000000000,
    ...overrides,
  } as ListingResponseDto;
}

describe("matchActiveCampaignForListing", () => {
  it("matches a campaign whose real name contains the listing's title (case-insensitive substring)", () => {
    const adAccounts = [buildAdAccount({ name: "Campaign BSD City Ready Huni Promo" })];
    const result = matchActiveCampaignForListing(buildListing({ title: "bsd city ready huni" }), [
      ...adAccounts,
    ]);
    expect(result.hasActiveCampaign).toBe(true);
    expect(result.matchedCampaigns).toHaveLength(1);
  });

  it("does not match an ACTIVE campaign whose name does not contain the listing's title", () => {
    const adAccounts = [buildAdAccount({ name: "Completely Unrelated Campaign" })];
    const result = matchActiveCampaignForListing(buildListing(), [...adAccounts]);
    expect(result.hasActiveCampaign).toBe(false);
    expect(result.matchedCampaigns).toHaveLength(0);
    expect(result.verdicts).toEqual([]);
  });

  it("does not match a non-ACTIVE campaign even with a matching name", () => {
    const adAccounts = [buildAdAccount({ status: AdStatus.PAUSED })];
    const result = matchActiveCampaignForListing(buildListing(), [...adAccounts]);
    expect(result.hasActiveCampaign).toBe(false);
    expect(result.matchedCampaigns).toHaveLength(0);
  });

  it("aggregates real per-ad verdicts across every matched campaign", () => {
    const adAccounts = [buildAdAccount({ verdict: Verdict.SCALE })];
    const result = matchActiveCampaignForListing(buildListing(), [...adAccounts]);
    expect(result.verdicts).toEqual([Verdict.SCALE]);
  });
});

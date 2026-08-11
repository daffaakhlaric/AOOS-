import type { Ad, AdAccount, Campaign } from "@aos/meta-ads-connector";
import {
  AdAccountId,
  AdBuilder,
  AdMetrics,
  AdSetBuilder,
  CampaignBuilder,
  Spend,
} from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { toAdAccountResponseDto } from "./campaign-response.dto.js";

function unwrap<T>(result: { ok: boolean; value?: T; error?: unknown }): T {
  if (!result.ok) {
    throw new Error(`unwrap failed: ${JSON.stringify(result.error)}`);
  }
  return result.value as T;
}

/**
 * `AdAccount` is exported from `@aos/meta-ads-connector` as a TYPE only (its class is not part of
 * the public API — only `PullCampaignData` constructs one internally, via `AdAccount.create`).
 * So this test builds a plain object satisfying the same shape `toAdAccountResponseDto` actually
 * reads (`id.toString()`, `name`, `businessManagerId`, `currency`, `timezone`, `syncedAt`,
 * `campaigns`) rather than a genuine `AdAccount` instance — the real `Campaign`/`AdSet`/`Ad`
 * entities nested inside it ARE real (`CampaignBuilder`/`AdSetBuilder`/`AdBuilder` are exported
 * as values), so this still exercises the mapper's real recursive traversal.
 */
function wrapInAdAccount(campaign: Campaign, overrides: Partial<AdAccount> = {}): AdAccount {
  const adAccountId = unwrap(AdAccountId.create("act_752604553578354"));
  return {
    id: adAccountId,
    name: "Test Ad Account",
    businessManagerId: "bm_1",
    currency: "IDR",
    timezone: "Asia/Jakarta",
    campaigns: [campaign],
    syncedAt: new Date("2026-01-02T00:00:00.000Z"),
    ...overrides,
  } as AdAccount;
}

describe("toAdAccountResponseDto", () => {
  it("serializes a full AdAccount -> Campaign -> AdSet -> Ad hierarchy into plain JSON", () => {
    const ad: Ad = unwrap(new AdBuilder().build());
    const adSet = unwrap(new AdSetBuilder().withAds([ad]).build());
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    const adAccount = wrapInAdAccount(campaign);

    const dto = toAdAccountResponseDto(adAccount);

    expect(dto).toMatchObject({
      id: "act_752604553578354",
      name: "Test Ad Account",
      businessManagerId: "bm_1",
      currency: "IDR",
      timezone: "Asia/Jakarta",
      syncedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(dto.campaigns).toHaveLength(1);
    const campaignDto = dto.campaigns[0];
    expect(campaignDto).toMatchObject({
      id: campaign.id.toString(),
      stableId: campaign.stableId.toString(),
      metaId: campaign.metaId,
      name: campaign.name,
      objective: campaign.objective,
      status: campaign.status,
      funnel: campaign.funnel,
      branch: campaign.branch,
      spend: campaign.spend.toNumber(),
    });
    expect(campaignDto?.adSets).toHaveLength(1);
    const adSetDto = campaignDto?.adSets[0];
    expect(adSetDto).toMatchObject({
      id: adSet.id.toString(),
      dailyBudget: adSet.dailyBudget.toNumber(),
      spend: adSet.spend.toNumber(),
    });
    expect(adSetDto?.ads).toHaveLength(1);
    const adDto = adSetDto?.ads[0];
    expect(adDto).toMatchObject({
      id: ad.id.toString(),
      metaId: ad.metaId,
      verdict: ad.verdict,
      daysSinceCreation: ad.daysSinceCreation,
    });
    expect(adDto?.metrics).toMatchObject({
      spend: ad.metrics.spend.toNumber(),
      impressions: ad.metrics.impressions,
      totalLead: ad.metrics.totalLead,
      rphChat: ad.metrics.rphChat.value,
    });
  });

  it("serializes an ad account with no campaigns to an empty array", () => {
    const adAccountId = unwrap(AdAccountId.create("act_1"));
    const adAccount = {
      id: adAccountId,
      name: "Empty Account",
      businessManagerId: "bm_2",
      currency: "IDR",
      timezone: "Asia/Jakarta",
      campaigns: [],
      syncedAt: new Date("2026-01-01T00:00:00.000Z"),
    } as unknown as AdAccount;
    const dto = toAdAccountResponseDto(adAccount);
    expect(dto.campaigns).toEqual([]);
  });

  it("serializes an undefined rph rate (zero spend/conversations) as null, not a class instance", () => {
    const zeroMetrics = unwrap(
      AdMetrics.create({
        spend: Spend.zero(),
        impressions: 0,
        reach: 0,
        clicks: 0,
        conversations: 0,
        d2: 0,
        d3: 0,
        d5: 0,
        leadForm: 0,
      }),
    );
    const ad = unwrap(new AdBuilder().withMetrics(zeroMetrics).build());
    const adSet = unwrap(new AdSetBuilder().withAds([ad]).build());
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    const adAccount = wrapInAdAccount(campaign);

    const dto = toAdAccountResponseDto(adAccount);

    expect(dto.campaigns[0]?.adSets[0]?.ads[0]?.metrics.rphChat).toBeNull();
    expect(dto.campaigns[0]?.adSets[0]?.ads[0]?.metrics.rphD3).toBeNull();
    expect(dto.campaigns[0]?.adSets[0]?.ads[0]?.metrics.rphLead).toBeNull();
  });
});

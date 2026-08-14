import { beforeEach, describe, expect, it } from "vitest";

import {
  CAMPAIGNS_CACHE_KEY,
  CAMPAIGNS_CACHE_TTL_MS,
  CAMPAIGNS_HISTORY_KEY,
  isCacheFresh,
  readCampaignsCache,
  readCampaignsHistory,
  writeCampaignsCache,
  type CampaignsCacheEntry,
} from "@/lib/campaignsCache";
import type { AdAccountSummaryDto } from "@/types/dashboard.types";

const DATA: AdAccountSummaryDto = {
  id: "act_1",
  name: "Mobix Main",
  syncedAt: "2026-08-14T02:49:22.218Z",
  campaigns: [],
  ads: [],
  totals: {
    spend: 0,
    clicks: 0,
    frequency: 0,
    conversations: 0,
    d2: 0,
    d3: 0,
    d5: 0,
    leadForm: 0,
    totalLead: 0,
    rphD3: null,
  },
  campaignCount: 0,
  adCount: 0,
};

function entry(fetchedAt: number, period = "last_30d"): CampaignsCacheEntry {
  return { data: DATA, fetchedAt, period };
}

describe("campaignsCache", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns undefined when nothing is cached", () => {
    expect(readCampaignsCache()).toBeUndefined();
  });

  it("returns undefined for a corrupt/foreign localStorage value rather than throwing", () => {
    localStorage.setItem(CAMPAIGNS_CACHE_KEY, "not json{{{");
    expect(readCampaignsCache()).toBeUndefined();
    localStorage.setItem(CAMPAIGNS_CACHE_KEY, JSON.stringify({ unrelated: true }));
    expect(readCampaignsCache()).toBeUndefined();
  });

  it("round-trips a written entry", () => {
    writeCampaignsCache(entry(1000));
    expect(readCampaignsCache()).toEqual(entry(1000));
  });

  it("isCacheFresh is true within the 60-minute TTL and false once elapsed", () => {
    const cached = entry(1000);
    expect(isCacheFresh(cached, 1000 + CAMPAIGNS_CACHE_TTL_MS - 1)).toBe(true);
    expect(isCacheFresh(cached, 1000 + CAMPAIGNS_CACHE_TTL_MS)).toBe(false);
  });

  it("has no history until a second write happens", () => {
    writeCampaignsCache(entry(1000));
    expect(readCampaignsHistory()).toEqual([]);
  });

  it("pushes the outgoing entry onto history on a second write", () => {
    writeCampaignsCache(entry(1000));
    writeCampaignsCache(entry(2000));
    expect(readCampaignsHistory()).toEqual([entry(1000)]);
    expect(readCampaignsCache()).toEqual(entry(2000));
  });

  it("caps history at 3 entries, dropping the oldest", () => {
    writeCampaignsCache(entry(1000));
    writeCampaignsCache(entry(2000));
    writeCampaignsCache(entry(3000));
    writeCampaignsCache(entry(4000));
    writeCampaignsCache(entry(5000));
    expect(readCampaignsHistory()).toEqual([entry(4000), entry(3000), entry(2000)]);
  });

  it("readCampaignsHistory returns [] for a corrupt/foreign value", () => {
    localStorage.setItem(CAMPAIGNS_HISTORY_KEY, JSON.stringify({ not: "an array" }));
    expect(readCampaignsHistory()).toEqual([]);
  });
});

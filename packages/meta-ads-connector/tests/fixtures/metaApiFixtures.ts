import type { MetaAd, MetaAdSet, MetaCampaign } from "../../src/types/MetaApiTypes.js";

export function makeCampaign(overrides: Partial<MetaCampaign> = {}): MetaCampaign {
  return {
    id: "120000000000001",
    name: "CTWA - Cinere - Test Drive",
    objective: "OUTCOME_ENGAGEMENT",
    status: "ACTIVE",
    created_time: "2026-01-01T00:00:00+0000",
    insights: {
      data: [
        {
          spend: "1000000",
          impressions: "50000",
          reach: "20000",
          clicks: "500",
          actions: [
            { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "40" },
            { action_type: "onsite_conversion.total_messaging_connection", value: "45" },
            { action_type: "onsite_conversion.lead", value: "5" },
          ],
          messaging_conversation_started: "45",
        },
      ],
    },
    ...overrides,
  };
}

export function makeAdSet(overrides: Partial<MetaAdSet> = {}): MetaAdSet {
  return {
    id: "120000000000002",
    name: "AdSet - Cinere - Broad",
    status: "ACTIVE",
    daily_budget: "10000000",
    insights: {
      data: [{ spend: "500000" }],
    },
    ...overrides,
  };
}

export function makeAd(overrides: Partial<MetaAd> = {}): MetaAd {
  return {
    id: "120000000000003",
    name: "Ad - Cinere - Creative 1",
    status: "ACTIVE",
    created_time: "2026-01-01T00:00:00+0000",
    insights: {
      data: [
        {
          spend: "250000",
          impressions: "10000",
          reach: "5000",
          clicks: "100",
          actions: [
            { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "20" },
            { action_type: "onsite_conversion.total_messaging_connection", value: "22" },
            { action_type: "onsite_conversion.lead", value: "2" },
          ],
          messaging_conversation_started: "22",
        },
      ],
    },
    ...overrides,
  };
}

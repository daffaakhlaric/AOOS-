import { describe, expect, it } from "vitest";

import { AnalyzeLlmPayloadSchema, AnalyzeRequestSchema } from "./analyze.dto.js";

const validAd = {
  id: "ad-1",
  stableId: "stable-1",
  metaId: "meta-1",
  name: "Ad 1",
  status: "ACTIVE",
  funnel: "MAAO2",
  branch: "BINTARO",
  verdict: "SCALE",
  metrics: {
    spend: 100,
    impressions: 1000,
    reach: 900,
    frequency: 1.1,
    clicks: 20,
    conversations: 10,
    d2: 1,
    d3: 2,
    d5: 3,
    leadForm: 1,
    totalLead: 2,
    rphChat: 10,
    rphD3: null,
    rphLead: null,
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  daysSinceCreation: 30,
};

const validAdSet = {
  id: "adset-1",
  stableId: "stable-adset-1",
  metaId: "meta-adset-1",
  name: "AdSet 1",
  status: "ACTIVE",
  branch: "BINTARO",
  dailyBudget: 100000,
  spend: 50000,
  ads: [validAd],
};

const validCampaign = {
  id: "campaign-1",
  stableId: "stable-campaign-1",
  metaId: "meta-campaign-1",
  name: "Campaign 1",
  objective: "OUTCOME_LEADS",
  status: "ACTIVE",
  funnel: "MAAO2",
  branch: "BINTARO",
  spend: 500000,
  createdAt: "2026-01-01T00:00:00.000Z",
  adSets: [validAdSet],
};

describe("AnalyzeRequestSchema", () => {
  it("accepts a real AdAccountResponseDto-shaped campaigns array", () => {
    const result = AnalyzeRequestSchema.safeParse({ campaigns: [validCampaign] });
    expect(result.success).toBe(true);
  });

  it("accepts an optional numeric totals bag", () => {
    const result = AnalyzeRequestSchema.safeParse({
      campaigns: [validCampaign],
      totals: { totalSpend: 500000, totalLeads: 12 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty campaigns array", () => {
    const result = AnalyzeRequestSchema.safeParse({ campaigns: [] });
    expect(result.success).toBe(true);
  });

  it("rejects a campaign missing required fields", () => {
    const { spend: _spend, ...campaignWithoutSpend } = validCampaign;
    const result = AnalyzeRequestSchema.safeParse({ campaigns: [campaignWithoutSpend] });
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric metric field", () => {
    const badAd = { ...validAd, metrics: { ...validAd.metrics, spend: "not-a-number" } };
    const badAdSet = { ...validAdSet, ads: [badAd] };
    const badCampaign = { ...validCampaign, adSets: [badAdSet] };
    const result = AnalyzeRequestSchema.safeParse({ campaigns: [badCampaign] });
    expect(result.success).toBe(false);
  });

  it("rejects a missing campaigns field", () => {
    const result = AnalyzeRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("AnalyzeLlmPayloadSchema", () => {
  it("accepts a well-formed LLM analyze payload", () => {
    const result = AnalyzeLlmPayloadSchema.safeParse({
      temuan: [{ icon: "🔴", judul: "Frekuensi tinggi", detail: "Ad #C001 sudah jenuh" }],
      rekomendasi: [
        {
          aksi: "SCALE",
          target: "#C001 nama iklan",
          alasan: "performa bagus",
          estimasi: "hemat Rp 500rb",
        },
      ],
      ringkasan: "Kondisi iklan cukup baik secara umum.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an aksi value outside SCALE/PAUSE/FIX/KEEP", () => {
    const result = AnalyzeLlmPayloadSchema.safeParse({
      temuan: [],
      rekomendasi: [{ aksi: "DELETE", target: "x", alasan: "y", estimasi: "z" }],
      ringkasan: "ok",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing ringkasan", () => {
    const result = AnalyzeLlmPayloadSchema.safeParse({ temuan: [], rekomendasi: [] });
    expect(result.success).toBe(false);
  });

  it("rejects malformed JSON shapes (not an object)", () => {
    const result = AnalyzeLlmPayloadSchema.safeParse("just a string");
    expect(result.success).toBe(false);
  });
});

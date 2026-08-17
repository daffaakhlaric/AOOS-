import { describe, expect, it } from "vitest";

import { AnalyzeLlmPayloadSchema, AnalyzeRequestSchema } from "./analyze.dto.js";

/**
 * Real bug fix regression fixture: this is the ACTUAL shape `apps/aaos-dashboard`'s
 * `AnalisaClient.tsx`/`SimulationWizardClient.tsx` send — the dashboard's own client-safe,
 * TRIMMED `CampaignSummaryDto`/`AdSetSummaryDto`/`AdSummaryDto`/`AdMetricsDto`
 * (`apps/aaos-dashboard/src/types/dashboard.types.ts`), never the backend-internal
 * `CampaignResponseDto` family (no `metaId` anywhere, no campaign-level `funnel`/`branch`/
 * `createdAt`, no ad-set-level `branch`/`dailyBudget`, no ad-level `createdAt`, no
 * `impressions`/`reach`/`rphChat` on metrics). Before this fix, `AnalyzeRequestSchema` required
 * all of those, so every real call from the dashboard failed `ZodValidationPipe` with a "Request
 * validation failed" error the first time either caller was actually exercised against real data.
 */
const dashboardShapedAd = {
  id: "ad-1",
  stableId: "stable-1",
  name: "Ad 1",
  status: "ACTIVE",
  funnel: "MAAO2",
  branch: "BINTARO",
  verdict: "SCALE",
  metrics: {
    spend: 100,
    frequency: 1.1,
    clicks: 20,
    conversations: 10,
    d2: 1,
    d3: 2,
    d5: 3,
    leadForm: 1,
    totalLead: 2,
    rphD3: null,
    rphLead: null,
  },
  // Optional on the real dashboard type — omitted here on purpose to also cover that case.
};

const dashboardShapedAdSet = {
  id: "adset-1",
  stableId: "stable-adset-1",
  name: "AdSet 1",
  status: "ACTIVE",
  spend: 50000,
  ads: [dashboardShapedAd],
};

const dashboardShapedCampaign = {
  id: "campaign-1",
  stableId: "stable-campaign-1",
  name: "Campaign 1",
  objective: "OUTCOME_LEADS",
  status: "ACTIVE",
  spend: 500000,
  adSets: [dashboardShapedAdSet],
};

describe("AnalyzeRequestSchema", () => {
  it("accepts the REAL trimmed dashboard-sent campaigns shape (regression guard for the real bug fix)", () => {
    const result = AnalyzeRequestSchema.safeParse({ campaigns: [dashboardShapedCampaign] });
    expect(result.success).toBe(true);
  });

  it("accepts daysSinceCreation when present (still optional either way)", () => {
    const result = AnalyzeRequestSchema.safeParse({
      campaigns: [
        {
          ...dashboardShapedCampaign,
          adSets: [
            {
              ...dashboardShapedAdSet,
              ads: [{ ...dashboardShapedAd, daysSinceCreation: 5 }],
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a totals bag whose values include null (real AdMetricsDto.rphD3/rphLead shape — regression guard)", () => {
    const result = AnalyzeRequestSchema.safeParse({
      campaigns: [dashboardShapedCampaign],
      totals: { spend: 500000, totalLead: 12, rphD3: null, rphLead: null },
    });
    expect(result.success).toBe(true);
  });

  it("accepts an optional numeric totals bag", () => {
    const result = AnalyzeRequestSchema.safeParse({
      campaigns: [dashboardShapedCampaign],
      totals: { totalSpend: 500000, totalLeads: 12 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty campaigns array", () => {
    const result = AnalyzeRequestSchema.safeParse({ campaigns: [] });
    expect(result.success).toBe(true);
  });

  it("rejects a campaign missing required fields", () => {
    const { spend: _spend, ...campaignWithoutSpend } = dashboardShapedCampaign;
    const result = AnalyzeRequestSchema.safeParse({ campaigns: [campaignWithoutSpend] });
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric metric field", () => {
    const badAd = {
      ...dashboardShapedAd,
      metrics: { ...dashboardShapedAd.metrics, spend: "not-a-number" },
    };
    const badAdSet = { ...dashboardShapedAdSet, ads: [badAd] };
    const badCampaign = { ...dashboardShapedCampaign, adSets: [badAdSet] };
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

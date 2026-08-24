import { describe, expect, it } from "vitest";

import {
  CampaignStrategyLlmPayloadSchema,
  CampaignStrategyRequestSchema,
} from "./campaign-strategy.dto.js";

const validRequest = {
  vertical: "AUTOMOTIVE" as const,
  tenantName: "DSS Motor",
  branchId: "UMUM",
  brandAngleIds: ["BRAND_TRUST"],
  productAngleValues: ["DP_RINGAN"],
  seasonal: { isSpecialPeriod: false, reasoning: "Periode normal" },
  trends: { available: false, reasoning: "n/a" },
  competitor: { available: false, reasoning: "n/a" },
  inventory: { available: false, reasoning: "n/a" },
  leadProfile: { totalLeads: 0, avgScore: 0, topBranches: [] },
  closing: { totalEvents: 0, topUnitModels: [], slowUnitModels: [] },
};

describe("CampaignStrategyRequestSchema", () => {
  it("accepts a minimal valid request", () => {
    expect(CampaignStrategyRequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it("rejects a vertical outside AUTOMOTIVE/PROPERTY", () => {
    const result = CampaignStrategyRequestSchema.safeParse({
      ...validRequest,
      vertical: "MADE_UP",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty brandAngleIds array", () => {
    const result = CampaignStrategyRequestSchema.safeParse({ ...validRequest, brandAngleIds: [] });
    expect(result.success).toBe(false);
  });
});

const validPayload = {
  campaignMode: "BOTH" as const,
  reasoning: "Stok normal",
  brandCampaign: {
    angle: "BRAND_TRUST",
    copy: "copy",
    objective: "OUTCOME_AWARENESS" as const,
    budgetPct: 30,
    reasoning: "r",
  },
  productCampaign: {
    angle: "DP_RINGAN",
    targetUnit: "Xpander",
    copy: "copy",
    objective: "OUTCOME_LEADS" as const,
    budgetPct: 70,
    reasoning: "r",
  },
  budgetRecommendation: { action: "MAINTAIN" as const, multiplier: 1.0, reasoning: "r" },
  targeting: { locations: ["Bintaro"], ageMin: 22, ageMax: 55, interests: ["x"], reasoning: "r" },
  timing: { bestHours: [10, 19], reasoning: "r" },
  urgency: "MEDIUM" as const,
  summary: "summary",
};

describe("CampaignStrategyLlmPayloadSchema", () => {
  it("accepts a valid BOTH payload with both brandCampaign and productCampaign", () => {
    expect(CampaignStrategyLlmPayloadSchema.safeParse(validPayload).success).toBe(true);
  });

  it("accepts a valid BRAND-only payload", () => {
    const { productCampaign: _productCampaign, ...rest } = validPayload;
    const result = CampaignStrategyLlmPayloadSchema.safeParse({ ...rest, campaignMode: "BRAND" });
    expect(result.success).toBe(true);
  });

  it("accepts a valid PRODUCT-only payload", () => {
    const { brandCampaign: _brandCampaign, ...rest } = validPayload;
    const result = CampaignStrategyLlmPayloadSchema.safeParse({ ...rest, campaignMode: "PRODUCT" });
    expect(result.success).toBe(true);
  });

  it("rejects BOTH mode missing brandCampaign", () => {
    const { brandCampaign: _brandCampaign, ...rest } = validPayload;
    expect(CampaignStrategyLlmPayloadSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects BOTH mode missing productCampaign", () => {
    const { productCampaign: _productCampaign, ...rest } = validPayload;
    expect(CampaignStrategyLlmPayloadSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects an out-of-range ageMin/ageMax", () => {
    const result = CampaignStrategyLlmPayloadSchema.safeParse({
      ...validPayload,
      targeting: { ...validPayload.targeting, ageMin: 5 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an hour outside 0-23 in bestHours", () => {
    const result = CampaignStrategyLlmPayloadSchema.safeParse({
      ...validPayload,
      timing: { ...validPayload.timing, bestHours: [25] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid urgency value", () => {
    const result = CampaignStrategyLlmPayloadSchema.safeParse({
      ...validPayload,
      urgency: "SUPER_HIGH",
    });
    expect(result.success).toBe(false);
  });
});

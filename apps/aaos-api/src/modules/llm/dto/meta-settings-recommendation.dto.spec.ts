import { PropertyAdAngle } from "@aos/creative-agent";
import { describe, expect, it } from "vitest";

import {
  MetaSettingsListingSchema,
  MetaSettingsRecommendationLlmPayloadSchema,
  MetaSettingsRecommendationRequestSchema,
} from "./meta-settings-recommendation.dto.js";

const baseRequest = {
  campaignId: "camp-1",
  campaignName: "Dijual Tanah di BSD 500m² SHM",
  objective: "OUTCOME_LEADS",
  status: "ACTIVE",
  verdict: "SCALE",
  ctr: 0.02,
  cpl: 35_746,
  benchmarkCplIDR: 100_000,
  benchmarkCtr: 0.025,
  maxFrequency: 1.8,
  totalLead: 60,
  spend: 2_144_749,
  dailyBudget: 750_000,
};

describe("MetaSettingsRecommendationRequestSchema", () => {
  it("accepts a real body with no listing (the common case — no persisted campaign->listing mapping exists)", () => {
    expect(MetaSettingsRecommendationRequestSchema.safeParse(baseRequest).success).toBe(true);
  });

  it("accepts a real body with a full real listing", () => {
    const result = MetaSettingsRecommendationRequestSchema.safeParse({
      ...baseRequest,
      listing: {
        propertyType: "TANAH",
        price: 2_000_000_000,
        city: "Tangerang Selatan",
        kecamatan: "Cisauk",
        landArea: 500,
        certificate: "SHM",
        highlights: ["Dekat pintu tol BSD", "Lingkungan berkembang"],
        description: "Kavling siap bangun.",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a listing missing the required real propertyType/price fields", () => {
    const result = MetaSettingsRecommendationRequestSchema.safeParse({
      ...baseRequest,
      listing: { city: "Tangerang Selatan" },
    });
    expect(result.success).toBe(false);
  });
});

describe("MetaSettingsListingSchema", () => {
  it("defaults highlights to an empty array (never fabricated) when omitted", () => {
    const result = MetaSettingsListingSchema.safeParse({ propertyType: "TANAH", price: 1 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.highlights).toEqual([]);
    }
  });
});

describe("MetaSettingsRecommendationLlmPayloadSchema", () => {
  function minimalPayload(overrides: Record<string, unknown> = {}) {
    return {
      audienceSettings: {
        strategy: "BROAD_ADVANTAGE_PLUS",
        strategyRationale: "x",
        geoTargeting: {
          locations: [{ name: "BSD City", radiusKm: 15, radiusRationale: "x" }],
          geoRationale: "x",
        },
        demographics: { ageMin: 25, ageMax: 55, gender: "all", ageRationale: "x" },
        interestTargeting: { use: false, useRationale: "x" },
        customAudiences: {
          retargeting: { recommended: false, rationale: "x" },
          lookalike: { recommended: false, rationale: "x" },
        },
        specialAdCategory: { required: true, category: "HOUSING", implications: "x" },
      },
      campaignSettings: {
        objective: "OUTCOME_LEADS",
        objectiveRationale: "x",
        buyingType: "AUCTION",
        campaignBudgetOptimization: false,
        cboRationale: "x",
        bidStrategy: "LOWEST_COST",
        bidStrategyRationale: "x",
        adSchedule: { use: false, rationale: "x" },
      },
      adSetSettings: {
        structure: "1 campaign -> 1 ad set -> N ads",
        optimizationGoal: "LEAD_GENERATION",
        optimizationRationale: "x",
        billingEvent: "IMPRESSIONS",
        budgetRecommendation: {
          dailyBudget: 750_000,
          minViable: 300_000,
          idealForLearning: 1_000_000,
          rationale: "x",
        },
        placementStrategy: {
          type: "ADVANTAGE_PLUS",
          placements: ["Facebook Feed"],
          rationale: "x",
        },
      },
      creativeRecommendations: {
        diversityTarget: "8 angle berbeda",
        copies: [
          {
            angle: PropertyAdAngle.DP_RINGAN,
            targetPersona: "first_home_buyer",
            hook: "x",
            headline: "x",
            primaryText: "x",
            description: "x",
            cta: "Send Message",
            recommendedFormat: "IMAGES_ONLY",
            visualDirection: "x",
            whyThisWorks: "x",
          },
        ],
      },
      trackingSetup: {
        pixelRequired: true,
        capi: { required: true, rationale: "x", eventsToTrack: ["Lead"] },
        utmParams: { template: "x", rationale: "x" },
        waLinkSetup: "x",
      },
      settingsSummaryCard: {
        oneLineRecommendation: "x",
        topPriorityChange: "x",
        estimatedImpact: "x",
      },
      ...overrides,
    };
  }

  it("accepts a real, minimal valid payload with 1 copy", () => {
    const result = MetaSettingsRecommendationLlmPayloadSchema.safeParse(minimalPayload());
    expect(result.success).toBe(true);
  });

  it("accepts all 8 real PropertyAdAngle values in copies", () => {
    const copies = Object.values(PropertyAdAngle).map((angle) => ({
      angle,
      targetPersona: "investor",
      hook: "x",
      headline: "x",
      primaryText: "x",
      description: "x",
      cta: "WhatsApp",
      recommendedFormat: "VIDEO_AND_IMAGES",
      visualDirection: "x",
      whyThisWorks: "x",
    }));
    const result = MetaSettingsRecommendationLlmPayloadSchema.safeParse(
      minimalPayload({
        creativeRecommendations: {
          ...(minimalPayload().creativeRecommendations as object),
          copies,
        },
      }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects a fabricated angle not in the real 8-member PropertyAdAngle enum", () => {
    const result = MetaSettingsRecommendationLlmPayloadSchema.safeParse(
      minimalPayload({
        creativeRecommendations: {
          ...(minimalPayload().creativeRecommendations as Record<string, unknown>),
          copies: [
            {
              angle: "harga",
              targetPersona: "investor",
              hook: "x",
              headline: "x",
              primaryText: "x",
              description: "x",
              cta: "WhatsApp",
              recommendedFormat: "VIDEO_AND_IMAGES",
              visualDirection: "x",
              whyThisWorks: "x",
            },
          ],
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  // The prompt asks for Meta's real 27-character headline limit, but the schema itself only caps
  // at a generous safety ceiling (80) — real, live-confirmed model behavior occasionally overshoots
  // the tight limit by a few characters, and there is no retry loop to ask for a fix. A headline
  // slightly over 27 (but under the safety ceiling) must NOT discard an otherwise-good real
  // recommendation; `MetaSettingsPanel`'s own character-count display shows the real overage.
  it("accepts a headline slightly over the real 27-character Meta limit (no retry loop — don't discard a good real recommendation)", () => {
    const result = MetaSettingsRecommendationLlmPayloadSchema.safeParse(
      minimalPayload({
        creativeRecommendations: {
          ...(minimalPayload().creativeRecommendations as Record<string, unknown>),
          copies: [
            {
              angle: PropertyAdAngle.DP_RINGAN,
              targetPersona: "x",
              hook: "x",
              headline: "Tanah BSD 500m2 SHM Siap Bangun",
              primaryText: "x",
              description: "x",
              cta: "WhatsApp",
              recommendedFormat: "IMAGES_ONLY",
              visualDirection: "x",
              whyThisWorks: "x",
            },
          ],
        },
      }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects a headline that blows past even the generous safety ceiling (genuinely broken output)", () => {
    const result = MetaSettingsRecommendationLlmPayloadSchema.safeParse(
      minimalPayload({
        creativeRecommendations: {
          ...(minimalPayload().creativeRecommendations as Record<string, unknown>),
          copies: [
            {
              angle: PropertyAdAngle.DP_RINGAN,
              targetPersona: "x",
              hook: "x",
              headline: "x".repeat(200),
              primaryText: "x",
              description: "x",
              cta: "WhatsApp",
              recommendedFormat: "IMAGES_ONLY",
              visualDirection: "x",
              whyThisWorks: "x",
            },
          ],
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts a body with campaignSettings.adSchedule omitted entirely (real, live-confirmed model behavior), defaulting to a real honest fallback", () => {
    const payload = minimalPayload();
    const { adSchedule: _adSchedule, ...campaignSettingsWithoutSchedule } =
      payload.campaignSettings;
    const result = MetaSettingsRecommendationLlmPayloadSchema.safeParse({
      ...payload,
      campaignSettings: campaignSettingsWithoutSchedule,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.campaignSettings.adSchedule.use).toBe(false);
    }
  });

  // Real, live-confirmed second variant of the same gap: the model sometimes DOES include the
  // adSchedule key, but with its own "rationale" sub-field missing — a partial object, not full
  // omission. Must be tolerated the same way.
  it("accepts campaignSettings.adSchedule present but missing its rationale sub-field, defaulting the rationale", () => {
    const payload = minimalPayload();
    const result = MetaSettingsRecommendationLlmPayloadSchema.safeParse({
      ...payload,
      campaignSettings: { ...payload.campaignSettings, adSchedule: { use: true } },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.campaignSettings.adSchedule.use).toBe(true);
      expect(result.data.campaignSettings.adSchedule.rationale.length).toBeGreaterThan(0);
    }
  });

  it("accepts explicit null for every optional field, normalizing to undefined/empty array", () => {
    const payload = minimalPayload();
    (payload.audienceSettings.demographics as Record<string, unknown>).note = null;
    (payload.audienceSettings.interestTargeting as Record<string, unknown>).stackingWarning = null;
    (payload.audienceSettings.customAudiences.retargeting as Record<string, unknown>).source = null;
    (payload.campaignSettings as Record<string, unknown>).bidCap = null;
    const result = MetaSettingsRecommendationLlmPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.audienceSettings.demographics.note).toBeUndefined();
      expect(result.data.campaignSettings.bidCap).toBeUndefined();
      expect(result.data.creativeRecommendations.copyPrinciples).toEqual([]);
      expect(result.data.creativeRecommendations.abTestMatrix).toEqual([]);
    }
  });
});

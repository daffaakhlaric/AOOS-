import { PropertyAdAngle } from "@aos/creative-agent";
import { z } from "zod";

import type { LlmUnavailableResponseDto } from "./llm-unavailable.dto.js";

/**
 * SAMANTHA META ADS SETTINGS + CREATIVE COPY — `LlmService.metaSettingsRecommendation`'s request
 * context. Same "composed CLIENT-SIDE from already-loaded real data, no second live Meta pull"
 * discipline `CampaignInsightRequestSchema` establishes — see that schema's own doc.
 *
 * REAL ADAPTATIONS from the pasted spec (investigated, not assumed):
 * - `listing` mirrors the REAL `ListingDto` fields (`apps/eyvra-dashboard/src/types/listing.types.ts`)
 *   — no `facilities` field exists (real field is `highlights: string[]`), no KPR/installment field
 *   exists anywhere in this codebase, `certificate` (not `legalStatus`) is the real SHM/legal field.
 *   `undefined` (the common case) when the caller has no real `listingId` for this campaign — no
 *   persisted campaign→listing mapping exists anywhere in this codebase (see `AndromedaHealthCard.
 *   tsx`'s own doc for the same real gap); the prompt is told to infer from `campaignName` instead,
 *   same honest fallback the pasted spec itself already anticipated.
 * - `benchmarkCtr` is a NEW real account-wide average CTR (`accountBenchmarkCtr`, mirroring the
 *   existing `accountBenchmarkCpl`) — no such benchmark existed before this feature.
 */
export const MetaSettingsListingSchema = z.object({
  propertyType: z.string().min(1),
  price: z.number().nonnegative(),
  city: z.string().min(1).optional(),
  kecamatan: z.string().min(1).optional(),
  landArea: z.number().nonnegative().optional(),
  buildArea: z.number().nonnegative().optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  /** Real `ListingDto.certificate` (e.g. "SHM", "HGB") — the closest real field to the pasted spec's "legalStatus". */
  certificate: z.string().min(1).optional(),
  highlights: z.array(z.string().min(1)).default([]),
  description: z.string().min(1).optional(),
});
export type MetaSettingsListingDto = z.infer<typeof MetaSettingsListingSchema>;

export const MetaSettingsRecommendationRequestSchema = z.object({
  campaignId: z.string().min(1),
  campaignName: z.string().min(1),
  objective: z.string().min(1),
  status: z.string().min(1),
  verdict: z.string().min(1),
  ctr: z.number().nonnegative().nullable(),
  cpl: z.number().nonnegative().nullable(),
  benchmarkCplIDR: z.number().positive().nullable(),
  /** New real account-wide average CTR (see this file's own doc) — `null` when the account has no real CTR data yet. */
  benchmarkCtr: z.number().nonnegative().nullable(),
  maxFrequency: z.number().nonnegative(),
  totalLead: z.number().nonnegative(),
  spend: z.number().nonnegative(),
  dailyBudget: z.number().nonnegative(),
  /** `undefined` when no real listingId is known for this campaign — see this file's own doc. */
  listing: MetaSettingsListingSchema.optional(),
});
export type MetaSettingsRecommendationRequestDto = z.infer<
  typeof MetaSettingsRecommendationRequestSchema
>;

const AUDIENCE_STRATEGIES = [
  "BROAD_ADVANTAGE_PLUS",
  "INTEREST",
  "RETARGETING",
  "LOOKALIKE",
] as const;
const GENDERS = ["all", "male", "female"] as const;
const INTEREST_CATEGORIES = ["property", "finance", "lifestyle", "location"] as const;
const REACH_SIZES = ["kecil", "medium", "besar"] as const;
const CAMPAIGN_OBJECTIVES = ["OUTCOME_LEADS", "OUTCOME_SALES", "OUTCOME_ENGAGEMENT"] as const;
const BID_STRATEGIES = ["LOWEST_COST", "BID_CAP", "COST_CAP"] as const;
const OPTIMIZATION_GOALS = ["LEAD_GENERATION", "CONVERSATIONS", "LINK_CLICKS"] as const;
const PLACEMENT_TYPES = ["ADVANTAGE_PLUS", "MANUAL"] as const;
/** Real, already-existing 2-member format enum `DiverseCreativeBriefSetRequestDto`/`PropertyCreatePackageBodySchema` use — reused rather than the pasted spec's fabricated 3rd value ("carousel", never a real option anywhere in this codebase's Kai pipeline). */
const CREATIVE_FORMATS = ["VIDEO_AND_IMAGES", "IMAGES_ONLY"] as const;
/** Real 8-member `PropertyAdAngle` enum (`@aos/creative-agent`) — replaces the pasted spec's fabricated 10-value angle taxonomy (harga/kpr/lokasi/lifestyle/problem_solution/urgency/comparison/curiosity/investasi/fitur), which has no backing anywhere in this codebase's real Kai pipeline. Every copy this endpoint generates is a real candidate for the SAME real `POST /api/v1/creative-packages/property` manual-brief endpoint (`PropertyCreatePackageBodySchema.angle: z.nativeEnum(PropertyAdAngle)`), so using the real enum here is what actually lets "Brief ke Kai" work end-to-end instead of needing a second, fabricated-to-real angle translation layer. */
const PROPERTY_AD_ANGLES = Object.values(PropertyAdAngle) as [
  PropertyAdAngle,
  ...PropertyAdAngle[],
];

function optionalString(maxLength?: number) {
  const base = maxLength !== undefined ? z.string().min(1).max(maxLength) : z.string().min(1);
  return base.nullish().transform((value) => value ?? undefined);
}

function optionalNumber() {
  return z
    .number()
    .nullish()
    .transform((value) => value ?? undefined);
}

/**
 * SAMANTHA META ADS SETTINGS + CREATIVE COPY — full LLM payload schema. Every field is the
 * model's own generated recommendation/reasoning over the real inputs above — advisory text for a
 * human media buyer to apply manually in Meta Ads Manager, same category as `CampaignInsightLlm
 * PayloadSchema`'s `playbook`/`scenarios` fields.
 *
 * DELIBERATELY OMITTED vs. the pasted spec (investigated, no real backing exists):
 * - `metaGeoKey`/any numeric Meta location or interest ID — this codebase's real Meta Targeting
 *   Search integration (`SearchAdInterests`/`SearchAdLocations` in `@aos/meta-ads-connector`) is
 *   READ-ONLY and live-query-only; there is no static ID table anywhere, so asking the model to
 *   output an ID would mean it invents one. `geoTargeting`/`interestTargeting` below carry real,
 *   human-readable DISCOVERY names only — the media buyer looks the real ID up live in Meta Ads
 *   Manager's own audience search.
 * - Any "apply settings" action — no real mutation exists anywhere in `IMetaAdsClient` for
 *   updating targeting/bid-strategy/placements/objective on an existing ad set (only budget-scale
 *   and pause/activate/objective-fix are real). This is advisory-only, same as `budgetDecision` in
 *   the campaign-insight payload.
 */
export const MetaSettingsRecommendationLlmPayloadSchema = z.object({
  audienceSettings: z.object({
    strategy: z.enum(AUDIENCE_STRATEGIES),
    strategyRationale: z.string().min(1),
    geoTargeting: z.object({
      locations: z
        .array(
          z.object({
            name: z.string().min(1),
            radiusKm: z.number().positive(),
            radiusRationale: z.string().min(1),
          }),
        )
        .min(1)
        .max(5),
      excluded: z.array(z.string().min(1)).max(10).default([]),
      geoRationale: z.string().min(1),
    }),
    demographics: z.object({
      ageMin: z.number().int().min(18).max(65),
      ageMax: z.number().int().min(18).max(65),
      gender: z.enum(GENDERS),
      ageRationale: z.string().min(1),
      note: optionalString(),
    }),
    interestTargeting: z.object({
      use: z.boolean(),
      useRationale: z.string().min(1),
      interests: z
        .array(
          z.object({
            name: z.string().min(1),
            category: z.enum(INTEREST_CATEGORIES),
            relevance: z.string().min(1),
            estimatedReach: z.enum(REACH_SIZES),
          }),
        )
        .max(10)
        .default([]),
      interestStacking: z.boolean().default(false),
      stackingWarning: optionalString(),
    }),
    customAudiences: z.object({
      retargeting: z.object({
        recommended: z.boolean(),
        source: optionalString(),
        rationale: z.string().min(1),
      }),
      lookalike: z.object({
        recommended: z.boolean(),
        sourcePct: optionalString(),
        rationale: z.string().min(1),
      }),
    }),
    specialAdCategory: z.object({
      required: z.boolean(),
      category: z.string().min(1),
      implications: z.string().min(1),
    }),
  }),

  campaignSettings: z.object({
    objective: z.enum(CAMPAIGN_OBJECTIVES),
    objectiveRationale: z.string().min(1),
    buyingType: z.string().min(1),
    campaignBudgetOptimization: z.boolean(),
    cboRationale: z.string().min(1),
    bidStrategy: z.enum(BID_STRATEGIES),
    bidStrategyRationale: z.string().min(1),
    bidCap: optionalNumber(),
    adSchedule: z.object({
      use: z.boolean(),
      rationale: z.string().min(1),
    }),
  }),

  adSetSettings: z.object({
    structure: z.string().min(1),
    optimizationGoal: z.enum(OPTIMIZATION_GOALS),
    optimizationRationale: z.string().min(1),
    billingEvent: z.string().min(1),
    budgetRecommendation: z.object({
      dailyBudget: z.number().positive(),
      minViable: z.number().positive(),
      idealForLearning: z.number().positive(),
      rationale: z.string().min(1),
    }),
    placementStrategy: z.object({
      type: z.enum(PLACEMENT_TYPES),
      placements: z.array(z.string().min(1)).min(1).max(10),
      excluded: z.array(z.string().min(1)).max(10).default([]),
      rationale: z.string().min(1),
    }),
  }),

  creativeRecommendations: z.object({
    diversityTarget: z.string().min(1),
    /**
     * Exactly one copy per real `PropertyAdAngle` member (8 total) — a clean 1:1 fit replacing
     * the pasted spec's arbitrary "minimum 8, with 2x harga angle" instruction, which only made
     * sense under its own fabricated 10-angle taxonomy.
     */
    copies: z
      .array(
        z.object({
          angle: z.enum(PROPERTY_AD_ANGLES),
          targetPersona: z.string().min(1),
          hook: z.string().min(1),
          headline: z.string().min(1).max(27),
          primaryText: z.string().min(1).max(125),
          description: z.string().min(1).max(30),
          cta: z.string().min(1),
          recommendedFormat: z.enum(CREATIVE_FORMATS),
          visualDirection: z.string().min(1),
          whyThisWorks: z.string().min(1),
        }),
      )
      .min(1)
      .max(8),
    copyPrinciples: z
      .array(z.string().min(1))
      .max(5)
      .nullish()
      .transform((v) => v ?? []),
    abTestMatrix: z
      .array(
        z.object({
          test: z.string().min(1),
          /** References a real `angle` value from `copies` above — never a fabricated `copyId`. */
          variantAAngle: z.enum(PROPERTY_AD_ANGLES),
          variantBAngle: z.enum(PROPERTY_AD_ANGLES),
          hypothesis: z.string().min(1),
          metric: z.string().min(1),
          winnerCriteria: z.string().min(1),
        }),
      )
      .max(3)
      .nullish()
      .transform((v) => v ?? []),
  }),

  trackingSetup: z.object({
    pixelRequired: z.boolean(),
    capi: z.object({
      required: z.boolean(),
      rationale: z.string().min(1),
      eventsToTrack: z.array(z.string().min(1)).min(1).max(6),
    }),
    utmParams: z.object({
      template: z.string().min(1),
      rationale: z.string().min(1),
    }),
    waLinkSetup: z.string().min(1),
  }),

  settingsSummaryCard: z.object({
    oneLineRecommendation: z.string().min(1).max(200),
    topPriorityChange: z.string().min(1),
    estimatedImpact: z.string().min(1),
  }),
});
export type MetaSettingsRecommendationLlmPayload = z.infer<
  typeof MetaSettingsRecommendationLlmPayloadSchema
>;

export type MetaSettingsRecommendationResponseDto =
  ({ readonly available: true } & MetaSettingsRecommendationLlmPayload) | LlmUnavailableResponseDto;

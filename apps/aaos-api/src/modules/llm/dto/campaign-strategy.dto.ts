import { z } from "zod";

import type { LlmUnavailableResponseDto } from "./llm-unavailable.dto.js";

/**
 * AAOS-SAMANTHA-INTELLIGENCE-LAYER Phase 4 ("PART 3: SAMANTHA DECISION ENGINE"). The ONE genuinely
 * LLM-dependent step of the wider Samantha Intelligence Layer effort (coordinator note point 4):
 * turns the already-aggregated, already-computed real signals from `packages/meta-ads-agent`'s
 * Phase 1-3 pure signal services into a `campaignMode`/angle/budget/targeting recommendation.
 *
 * Deliberately a loose, JSON-safe "prompt context" bag (same discipline
 * `CreativeBriefRequestSchema`/`SelectTargetingRequestSchema` already establish) rather than the
 * full typed `SeasonalRecommendation`/`TrendsData[]`/etc. interfaces those services return — the
 * caller (`IntelligenceService`, `apps/aaos-api/src/modules/intelligence`) has already reduced
 * each real signal (including its own honest degraded/"unavailable" states — see
 * `GoogleTrendsService`/`CompetitorIntelService`'s own `Result.err` discipline) into a plain object
 * this schema can validate, before it ever reaches this module.
 */
const SeasonalContextSchema = z.object({
  isSpecialPeriod: z.boolean(),
  eventName: z.string().optional(),
  budgetMultiplier: z.number().optional(),
  upcomingEvent: z.string().optional(),
  daysUntil: z.number().optional(),
  recommendedAngles: z.array(z.string()).optional(),
  reasoning: z.string(),
});

const TrendsContextSchema = z.object({
  available: z.boolean(),
  shouldScaleBudget: z.boolean().optional(),
  suggestedAngle: z.string().optional(),
  risingKeywords: z.array(z.string()).optional(),
  reasoning: z.string(),
});

const CompetitorContextSchema = z.object({
  available: z.boolean(),
  saturatedAngles: z.array(z.string()).optional(),
  unusedAngles: z.array(z.string()).optional(),
  topCompetitorAngle: z.string().optional(),
  reasoning: z.string(),
});

const InventoryContextSchema = z.object({
  available: z.boolean(),
  hasLowStock: z.boolean().optional(),
  lowStockItems: z.array(z.string()).optional(),
  hasNewArrivals: z.boolean().optional(),
  newArrivalItems: z.array(z.string()).optional(),
  slowMovingItems: z.array(z.string()).optional(),
  recommendedAngle: z.string().optional(),
  reasoning: z.string(),
});

const LeadProfileContextSchema = z.object({
  totalLeads: z.number(),
  avgScore: z.number(),
  topBranches: z.array(z.object({ branchId: z.string(), count: z.number() })),
  peakHour: z.number().optional(),
  peakDay: z.number().optional(),
});

const ClosingContextSchema = z.object({
  totalEvents: z.number(),
  topUnitModels: z.array(
    z.object({ unitModel: z.string(), spkCount: z.number(), closingRate: z.number() }),
  ),
  slowUnitModels: z.array(z.object({ unitModel: z.string(), closingRate: z.number() })),
});

/**
 * AAOS LOOP UPGRADE, Sprint 7 Prompt 18 ("Market Intelligence") — real, additive context from
 * `MarketIntelligenceService.refresh()` (`modules/market-intelligence`), threaded in ALONGSIDE the
 * existing `seasonal`/`trends`/`competitor` context above (never replacing it — the two modules
 * cover overlapping-but-distinct real sources, see `046_market_signals.sql`'s header doc). Kept
 * `.optional()` so a `CampaignStrategyRequestDto` built before this field existed (or a caller that
 * genuinely has no Market Intelligence run yet) still validates — `IntelligenceService.refresh`
 * always sends it now, but this schema itself must not require a field impossible to satisfy the
 * very first time `market_signals` has never been refreshed for a tenant.
 */
const MarketSignalsContextSchema = z.object({
  searchTrend: z.object({
    available: z.boolean(),
    keywords: z.array(z.object({ keyword: z.string(), delta: z.string() })).optional(),
    reasoning: z.string(),
  }),
  competitorAngleTrend: z.object({
    available: z.boolean(),
    angleCounts: z.record(z.string(), z.number()).optional(),
    topAngle: z.string().optional(),
    reasoning: z.string(),
  }),
  kprRate: z.object({
    available: z.boolean(),
    currentPct: z.number().optional(),
    direction: z.string().optional(),
    reasoning: z.string(),
  }),
  seasonality: z.object({
    status: z.enum(["musim ramai", "musim sepi"]),
    note: z.string(),
  }),
});

export const CampaignStrategyRequestSchema = z.object({
  vertical: z.enum(["AUTOMOTIVE", "PROPERTY"]),
  tenantName: z.string().min(1),
  branchId: z.string().min(1),
  /** Real brand-angle ids Samantha may choose for `brandCampaign.angle` (from `@aos/meta-ads-agent`'s `BRAND_ANGLES[vertical]`) — sent explicitly so the prompt's vocabulary always matches this request's real vertical. */
  brandAngleIds: z.array(z.string().min(1)).min(1),
  /** Real product-angle values Samantha may choose for `productCampaign.angle` (`AdAngle` members for AUTOMOTIVE, `PropertyAdAngle` string values for PROPERTY). */
  productAngleValues: z.array(z.string().min(1)).min(1),
  seasonal: SeasonalContextSchema,
  trends: TrendsContextSchema,
  competitor: CompetitorContextSchema,
  inventory: InventoryContextSchema,
  leadProfile: LeadProfileContextSchema,
  closing: ClosingContextSchema,
  /** AAOS LOOP UPGRADE, Sprint 7 Prompt 18 — see `MarketSignalsContextSchema`'s own doc. */
  marketSignals: MarketSignalsContextSchema.optional(),
});
export type CampaignStrategyRequestDto = z.infer<typeof CampaignStrategyRequestSchema>;

const BrandCampaignSchema = z.object({
  angle: z.string().min(1),
  copy: z.string().min(1),
  objective: z.enum(["OUTCOME_AWARENESS", "OUTCOME_LEADS", "OUTCOME_ENGAGEMENT"]),
  budgetPct: z.number().min(0).max(100),
  reasoning: z.string().min(1),
});

const ProductCampaignSchema = z.object({
  angle: z.string().min(1),
  targetUnit: z.string().min(1),
  copy: z.string().min(1),
  objective: z.literal("OUTCOME_LEADS"),
  budgetPct: z.number().min(0).max(100),
  reasoning: z.string().min(1),
});

/**
 * The shape Samantha's `campaign-strategy` system prompt asks the model to return — spec PART 3's
 * `CampaignStrategy` JSON, angle-vocabulary corrections aside (real `AdAngle`/`PropertyAdAngle`/
 * `BRAND_ANGLES` values, never the spec's fictional angle names).
 *
 * `angle` fields are validated as non-empty strings here only — Zod alone cannot check membership
 * in a per-request vertical-specific vocabulary (unlike `CreativeBriefLlmPayloadSchema`'s static
 * `z.nativeEnum(AdAngle)`, this schema is shared across both verticals). `LlmService.
 * campaignStrategy` does the real membership check post-parse, against the SAME
 * `brandAngleIds`/`productAngleValues` the request itself supplied — same "fail closed on a
 * hallucinated angle" discipline as every other `llm` method, just enforced one step later because
 * the valid set is per-request here rather than a single static enum.
 */
export const CampaignStrategyLlmPayloadSchema = z
  .object({
    campaignMode: z.enum(["BRAND", "PRODUCT", "BOTH"]),
    reasoning: z.string().min(1),
    brandCampaign: BrandCampaignSchema.optional(),
    productCampaign: ProductCampaignSchema.optional(),
    budgetRecommendation: z.object({
      action: z.enum(["SCALE", "REDUCE", "MAINTAIN"]),
      multiplier: z.number().positive(),
      reasoning: z.string().min(1),
    }),
    targeting: z.object({
      locations: z.array(z.string()),
      ageMin: z.number().int().min(17).max(100),
      ageMax: z.number().int().min(17).max(100),
      interests: z.array(z.string()),
      reasoning: z.string().min(1),
    }),
    timing: z.object({
      bestHours: z.array(z.number().int().min(0).max(23)),
      reasoning: z.string().min(1),
    }),
    urgency: z.enum(["HIGH", "MEDIUM", "LOW"]),
    summary: z.string().min(1),
  })
  .refine(
    (payload) =>
      (payload.campaignMode !== "BRAND" && payload.campaignMode !== "BOTH") ||
      payload.brandCampaign !== undefined,
    { message: "brandCampaign is required when campaignMode is BRAND or BOTH" },
  )
  .refine(
    (payload) =>
      (payload.campaignMode !== "PRODUCT" && payload.campaignMode !== "BOTH") ||
      payload.productCampaign !== undefined,
    { message: "productCampaign is required when campaignMode is PRODUCT or BOTH" },
  );
export type CampaignStrategyLlmPayload = z.infer<typeof CampaignStrategyLlmPayloadSchema>;

export type CampaignStrategyResponseDto =
  ({ readonly available: true } & CampaignStrategyLlmPayload) | LlmUnavailableResponseDto;

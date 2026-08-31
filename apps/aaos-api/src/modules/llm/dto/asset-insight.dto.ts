import { z } from "zod";

import type { LlmUnavailableResponseDto } from "./llm-unavailable.dto.js";

/**
 * `LlmService.assetInsight` request context (AAOS Analytics Platform Phase 4, "Creative
 * Drill-Down" — the one real LLM-generated insight this phase adds, contrast Phase 3's
 * deliberately deterministic `generateHeatmapInsight`). Composed server-side by
 * `MetaAdsService.getAssetDetail` from its own already-computed `AssetDetailResponseDto` fields —
 * same "loose, JSON-safe prompt context bag built from real, already-aggregated data" discipline
 * `CampaignStrategyRequestSchema`'s own docstring establishes, never accepted raw from an HTTP
 * caller.
 */
const AssetInsightAudienceRowSchema = z.object({
  audienceLabel: z.string(),
  adCount: z.number(),
  spend: z.number(),
  totalLead: z.number(),
  cpl: z.number().nullable(),
});

export const AssetInsightRequestSchema = z.object({
  assetKind: z.enum(["IMAGE", "VIDEO"]),
  assetId: z.string().min(1),
  adCount: z.number(),
  spend: z.number(),
  totalLead: z.number(),
  cpl: z.number().nullable(),
  maxFrequency: z.number(),
  audienceBreakdown: z.array(AssetInsightAudienceRowSchema),
  benchmarkCplIDR: z.number().nullable(),
});
export type AssetInsightRequestDto = z.infer<typeof AssetInsightRequestSchema>;

/**
 * The shape Samantha's `asset-insight` system prompt asks the model to return — a single Bahasa
 * Indonesia paragraph, same "one real, concrete observation" spirit `generateHeatmapInsight`'s own
 * deterministic template already establishes for the heatmap, just LLM-authored here per the
 * design doc's explicit instruction for this one endpoint.
 */
export const AssetInsightLlmPayloadSchema = z.object({
  summary: z.string().min(1),
});
export type AssetInsightLlmPayload = z.infer<typeof AssetInsightLlmPayloadSchema>;

export type AssetInsightResponseDto =
  ({ readonly available: true } & AssetInsightLlmPayload) | LlmUnavailableResponseDto;

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
 * Creative-Hub "4 gaps" dispatch, gap 3 — real Kai/Samantha split. Investigated first (never
 * guessed): the pasted spec proposed two NEW Anthropic-SDK-calling methods
 * (`kaiAnalyzeCreative`/`samanthaAnalyzeCreative`), which would violate this codebase's strict
 * "only `LlmService` calls the LLM provider" convention. A second real candidate —
 * `LlmService.diagnoseAdCopy` (Samantha Professional Optimizer Part C) reused as the "Kai" half —
 * was investigated and ruled out: its own real system prompt opens with "Kamu adalah Samantha, AI
 * Marketing Manager..." (`DIAGNOSE_AD_COPY_SYSTEM_PROMPT` below), i.e. it is ALSO Samantha-voiced,
 * not Kai-voiced as the pasted spec assumed — pairing it with `assetInsight` would produce two
 * Samantha outputs, not a real Kai/Samantha split. `diagnoseAdCopy` is also scoped to one ad's copy
 * TEXT (which this asset-level endpoint's `AssetInsightRequestDto` doesn't carry at all — it only
 * has audience/spend/CPL aggregates), so it isn't even reachable from this context without a
 * second, real network round-trip.
 *
 * The honest, minimal, architecture-consistent fix: widen THIS single real LLM call's requested
 * output to two distinct sections from the SAME underlying `AssetInsightRequestDto` data — a
 * Kai-persona creative-strategist read (which audience/creative angle to lean into next) and a
 * Samantha-persona media-buyer verdict (scale/hold/kill this asset+audience combo) — one call, one
 * cache entry, no new method, no new provider call site. Replaces the old single `summary` field
 * (every real caller — `AssetDetailModal.tsx`, `AssetDetailClient.tsx` — updated to render both).
 */
export const AssetInsightLlmPayloadSchema = z.object({
  kaiTake: z.string().min(1),
  samanthaVerdict: z.string().min(1),
});
export type AssetInsightLlmPayload = z.infer<typeof AssetInsightLlmPayloadSchema>;

export type AssetInsightResponseDto =
  ({ readonly available: true } & AssetInsightLlmPayload) | LlmUnavailableResponseDto;

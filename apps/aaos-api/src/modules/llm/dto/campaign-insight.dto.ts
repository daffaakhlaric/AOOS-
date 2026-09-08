import { z } from "zod";

import type { LlmUnavailableResponseDto } from "./llm-unavailable.dto.js";

/**
 * `LlmService.campaignInsight` request context — Campaign page unified rebuild (AAOS-CAMPAIGNS-
 * UNIFIED-PAGE), the real backend for `CampaignInsightPanel`'s AI narrative + prioritized action
 * list.
 *
 * Deliberately composed CLIENT-SIDE from data the dashboard's `/campaigns` page already has
 * loaded (`AdAccountSummaryDto`'s campaign→ad-set→ad tree from `/api/campaigns`, the SAME
 * `useCampaignsSnapshot()` snapshot `MetricsTab.tsx`/`CampaignTable` already read) — this endpoint
 * does NOT re-pull from Meta itself (same "reuse already-loaded data, no second live pull"
 * discipline `CampaignDetailDrawer.tsx`/`WinningCombos.tsx` already established). Every field is a
 * real sum/derived ratio of already-fetched ad metrics, never re-computed by guessing — same
 * aggregation math `MetricsTab.tsx`'s own `aggregateAdMetrics`/`costPerResult`/`ctr`/`cpm` helpers
 * use, mirrored server-side here only for the one selected campaign's scope so the LLM prompt gets
 * real numbers, not a client-trusted narrative.
 */
export const CampaignInsightRequestSchema = z.object({
  campaignId: z.string().min(1),
  campaignName: z.string().min(1),
  /** Real aggregate verdict already computed client-side by `aggregateVerdict` (CampaignTree.tsx's own precedence over this campaign's real per-ad VerdictEngine outputs) — never recomputed here from raw numbers, so this can never drift from the authoritative verdict shown elsewhere on the page. */
  verdict: z.string().min(1),
  spend: z.number().nonnegative(),
  totalLead: z.number().nonnegative(),
  clicks: z.number().nonnegative(),
  /** `null` when no ad in this campaign carries a real `impressions` value (optional field, see `AdMetricsDto.impressions`'s own doc) — never a fabricated 0. */
  impressions: z.number().nonnegative().nullable(),
  maxFrequency: z.number().nonnegative(),
  adCount: z.number().int().nonnegative(),
  adSetCount: z.number().int().nonnegative(),
  /** Real `spend / totalLead` — `null` when `totalLead` is 0 (division-by-zero safe, same convention `rphLead`/`costPerResult` already use). */
  cpl: z.number().nonnegative().nullable(),
  /** Real account-wide benchmark CPL for the CPL color-pill comparison (`< 85%` green / `85-115%` amber / `> 115%` red) — either the tenant's real `property_objectives.targetCpl` business-context field when filled in, or a real account-wide average CPL computed from the same snapshot as a fallback. `null` when neither is available (a brand-new tenant with 0 total leads account-wide). */
  benchmarkCplIDR: z.number().positive().nullable(),
});
export type CampaignInsightRequestDto = z.infer<typeof CampaignInsightRequestSchema>;

const ACTION_PRIORITIES = ["SEGERA", "MINGGU_INI", "BULAN_INI"] as const;

export const CampaignInsightLlmPayloadSchema = z.object({
  narrative: z.string().min(1),
  actions: z
    .array(
      z.object({
        priority: z.enum(ACTION_PRIORITIES),
        text: z.string().min(1),
      }),
    )
    .max(8),
});
export type CampaignInsightLlmPayload = z.infer<typeof CampaignInsightLlmPayloadSchema>;

export type CampaignInsightResponseDto =
  ({ readonly available: true } & CampaignInsightLlmPayload) | LlmUnavailableResponseDto;

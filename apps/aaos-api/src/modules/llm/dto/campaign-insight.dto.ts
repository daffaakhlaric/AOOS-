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
/**
 * SAMANTHA ADVANCED SPRINT 2 — one real per-ad row for the `ads` breakdown below. Mirrors the exact
 * real fields `CampaignAdDrillDown.tsx` already computes/renders for every ad in this campaign
 * (`AdSummaryDto.stableId/name/verdict`, `AdMetricsDto.spend/conversations/frequency`, the same
 * `rphChat` = `spend / conversations` ratio that file's own `rphChat` helper computes, and the
 * parent ad set's real `AdSetSummaryDto.learningStatus`) — nothing new is computed here, this is the
 * same real numbers already on screen, just threaded into the LLM prompt so the narrative can name a
 * SPECIFIC underperforming or top-performing ad instead of only reporting the campaign aggregate.
 */
export const CampaignInsightAdSchema = z.object({
  stableId: z.string().min(1),
  name: z.string().min(1),
  /** Real per-ad `VerdictEngine` verdict (SCALE/KEEP/REVIEW/PAUSE/FIX/REFRESH) — same convention as the campaign-level `verdict` field, never recomputed here. */
  verdict: z.string().min(1),
  spend: z.number().nonnegative(),
  conversations: z.number().nonnegative(),
  /** Real `spend / conversations` — `null` when `conversations` is 0 (division-by-zero safe, same `rphChat` convention `CampaignAdDrillDown.tsx` already uses). */
  rphChatIDR: z.number().nonnegative().nullable(),
  frequency: z.number().nonnegative(),
  /** Real Meta `learning_stage_info.status` of this ad's PARENT ad set (`AdSetSummaryDto.learningStatus`) — `undefined` when Meta didn't report one, same optionality as that field's own source. */
  learningStatus: z.string().optional(),
});
export type CampaignInsightAdDto = z.infer<typeof CampaignInsightAdSchema>;

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
  /**
   * SAMANTHA ADVANCED SPRINT 2 — real per-ad breakdown for THIS campaign (see `CampaignInsightAdSchema`
   * above), composed client-side from the same `campaign.adSets` tree `CampaignAdDrillDown` already
   * renders. `.optional()` (not required) so an older, pre-Sprint-2 client body shape still validates
   * — additive, never a breaking schema change. Capped generously (200) as a payload-size guard, not
   * because any real campaign is expected to hit it.
   */
  ads: z.array(CampaignInsightAdSchema).max(200).optional(),
  /**
   * SAMANTHA ADVANCED SPRINT 2 — real `stableId`s of this campaign's ad sets still in Meta's
   * "LEARNING" phase (`AdSetSummaryDto.learningStatus === "LEARNING"`, the exact status
   * `CampaignAdDrillDown.tsx`'s own `🎓 Learning` badge already flags) — an empty array when none are
   * learning, `undefined` only for a pre-Sprint-2 caller. Lets the narrative apply the same
   * professional "don't over-react to a Learning Phase ad set" caveat `diagnoseAdCopy`'s
   * `learningPhaseNote` already applies at the per-ad level, at the campaign level too.
   */
  learningAdSetStableIds: z.array(z.string()).optional(),
  /**
   * SAMANTHA ADVANCED SPRINT 2 — real, already-persisted `MarketSignalsResponseDto.digestText` for
   * this tenant's vertical (`GET /api/market-signals/latest` — AAOS LOOP UPGRADE Sprint 7's Market
   * Intelligence digest, the same real text `MarketSignalsCard.tsx` would show). `null` when the
   * tenant genuinely has no market-signals row yet (first weekly refresh hasn't run) or the row's own
   * `digestText` is `null` — `undefined` only for a pre-Sprint-2 caller, or when the client's own
   * best-effort fetch of that endpoint failed (this field is deliberately best-effort and must never
   * block or fail the campaign-insight call itself).
   */
  marketDigest: z.string().nullable().optional(),
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

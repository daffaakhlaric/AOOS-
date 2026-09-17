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

const DIVERSITY_STATUSES = ["NOT_ENOUGH_DATA", "LOW_DIVERSITY", "DIVERSE"] as const;

/**
 * SAMANTHA ADVANCED INSIGHT ENGINE — real Andromeda creative-diversity signal, mirrored field-for-
 * field from `AndromedaHealthDto.diversity` (`AndromedaHealthCard.tsx`'s own real, already-fetched
 * `GET /api/campaigns/:campaignId/andromeda-health` data — Sprint 1's `scoreCreativeDiversity`).
 * Deliberately reused rather than re-scored here: this is the exact real number/status the manager
 * already sees on the Andromeda Health card immediately below this panel, so the two can never say
 * different things about the same campaign. Replaces the pasted spec's fabricated "0-100 diversity
 * score" / "estimated Entity IDs" concepts — neither exists as a real field anywhere in this
 * codebase; this real status/count pair is the honest substitute.
 */
export const CampaignInsightAndromedaDiversitySchema = z.object({
  status: z.enum(DIVERSITY_STATUSES),
  totalAdCount: z.number().int().nonnegative(),
  distinctCreativeAssetCount: z.number().int().nonnegative().optional(),
  reasoning: z.string().min(1),
});
export type CampaignInsightAndromedaDiversityDto = z.infer<
  typeof CampaignInsightAndromedaDiversitySchema
>;

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
   * SAMANTHA ADVANCED INSIGHT ENGINE — real, already-pulled `AdSetSummaryDto.dailyBudget` summed
   * per-campaign (`aggregateCampaign`, the SAME real ABO/CBO-aware sum `UnifiedCampaignTable`'s
   * "Daily Budget" column and `BudgetTracker`'s estimate already use) — lets the model reason about
   * `budgetDecision.currentBudget`/`recommendedBudget` against a real starting number, never a
   * guess. `0` (never `null`) for a campaign with genuinely no real ad-set/campaign-level budget yet.
   */
  dailyBudget: z.number().nonnegative(),
  /** Real, division-by-zero-safe CPC/CPM (`campaignInsightMath.ts`'s own `cpcFromAggregate`/`cpmFromAggregate`) — `null` when clicks/impressions are honestly 0, same convention as `cpl`. */
  cpc: z.number().nonnegative().nullable(),
  cpm: z.number().nonnegative().nullable(),
  /** Real, additive Meta `reach` (`CampaignAggregate.reach`) — `null` when no ad carries a real value yet, same convention as `impressions`. */
  reach: z.number().nonnegative().nullable(),
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
  /**
   * Campaign Page Rebuild v2 / SAMANTHA ADVANCED INSIGHT ENGINE — real, already-persisted daily
   * values for this campaign's last up-to-7 real synced days (`GET /api/v1/campaigns/:campaignId/
   * history`, `meta_insights_daily` — see that endpoint's own doc for why this is a plain DB read,
   * not a second live Meta pull), oldest-to-newest. Each `undefined`/omitted independently (never a
   * fabricated flat line) when the client's own best-effort history fetch returned no rows yet.
   */
  ctrTrend7d: z.array(z.number().nonnegative()).max(30).optional(),
  spendTrend7d: z.array(z.number().nonnegative()).max(30).optional(),
  resultsTrend7d: z.array(z.number().nonnegative()).max(30).optional(),
  freqTrend7d: z.array(z.number().nonnegative()).max(30).optional(),
  /** SAMANTHA ADVANCED INSIGHT ENGINE — see `CampaignInsightAndromedaDiversitySchema`'s own doc. `undefined` when the client's best-effort `andromeda-health` fetch hasn't resolved yet or failed. */
  andromedaDiversity: CampaignInsightAndromedaDiversitySchema.optional(),
  /**
   * SAMANTHA ADVANCED INSIGHT ENGINE — real count of this campaign's real `LeadDto`s with
   * `temperature === "HOT"` (grouped client-side by the real `LeadDto.campaignId`, the same
   * real attribution `ObjectiveStripCard.tsx`'s own per-campaign breakdown uses — see that field's
   * own doc for why it was only recently modeled). `undefined` when the client's best-effort
   * `/api/leads` fetch hasn't resolved yet or failed — never a fabricated 0. Deliberately no real
   * "deals"/"revenue" field exists anywhere in this codebase (no CRM deal/revenue tracking — see
   * `BudgetTracker.tsx`'s own investigation for the same conclusion), so this is the ONLY real
   * revenue-adjacent signal available to Samantha here.
   */
  hotLeadsCount: z.number().int().nonnegative().optional(),
});
export type CampaignInsightRequestDto = z.infer<typeof CampaignInsightRequestSchema>;

/**
 * SAMANTHA ADVANCED INSIGHT ENGINE — real 6-value `Verdict` vocabulary (`@aos/meta-ads-connector`'s
 * own enum) the model must pick from. The pasted spec's own "CREATIVE" verdict does not exist
 * anywhere in this codebase; the prompt instructs the model to use `REFRESH` (Meta's real
 * creative-fatigue verdict) for that same real-world meaning instead — see `CAMPAIGN_INSIGHT_
 * SYSTEM_PROMPT`'s own note.
 */
const VERDICTS = ["SCALE", "KEEP", "REVIEW", "REFRESH", "FIX", "PAUSE"] as const;
const TRIAGE_LEVELS = ["DARURAT", "KRITIS", "PERLU_PERHATIAN", "SEHAT"] as const;
const METRIC_STATUSES = ["critical", "warning", "good", "neutral"] as const;
const TRENDS = ["naik", "turun", "stabil"] as const;
const KAI_URGENCIES = ["immediate", "this_week", "next_cycle"] as const;
const BUDGET_RECOMMENDATIONS = ["increase", "maintain", "decrease", "pause"] as const;

const PlaybookStepSchema = z.object({
  action: z.string().min(1),
  how: z.string().min(1),
  why: z.string().min(1),
  expectedResult: z.string().min(1),
  /** Optional — a HEALTHY campaign's `immediate`/`shortTerm` step (e.g. "monitor") may honestly have no "if not done" risk worth naming. */
  risk_if_not: z.string().min(1).optional(),
});

/**
 * SAMANTHA ADVANCED INSIGHT ENGINE — full rewrite of the campaign-insight LLM payload, replacing
 * Campaign Page Rebuild v2's `diagnosis`/`metricEvidence`/`contextNote`/`actions` shape with a
 * senior-media-buyer diagnosis framework: Triage → Root Cause → Evidence (`metricBreakdown`) →
 * Treatment (`playbook`) → Prognosis (`scenarios`). Every field here is the model's own generated
 * diagnostic REASONING over the real, already-verified inputs above — not a "real metric" that
 * could itself be fabricated, the same category as the superseded `diagnosis`/`actions` fields
 * were. Deliberately DROPS the pasted spec's `kpis` block (a set of LLM-formatted metric strings) —
 * `CampaignInsightPanel`'s own KPI grid already renders every one of those numbers with real,
 * client-side `formatIdr`/`formatPercent` formatting; duplicating them as LLM-generated strings
 * would only risk the two disagreeing. Also drops `andromedaScore`-adjacent output (no such field
 * exists in the request either — see `CampaignInsightAndromedaDiversitySchema`'s own doc).
 */
export const CampaignInsightLlmPayloadSchema = z.object({
  triage: z.object({
    level: z.enum(TRIAGE_LEVELS),
    /** ONE sentence, specific to this campaign's own real numbers — never a generic level description. */
    why: z.string().min(1).max(300),
  }),
  verdict: z.enum(VERDICTS),
  confidence: z.number().int().min(0).max(100),
  /** ONE sharp sentence max 200 chars — real number + real reason + concrete next step, not a description. */
  verdictOneLiner: z.string().min(1).max(200),

  rootCause: z.object({
    primary: z.string().min(1),
    primaryEvidence: z.string().min(1),
    secondary: z.string().min(1).optional(),
    /** What this is NOT, and why — excludes false alarms (e.g. "bukan audience exhaustion karena reach masih naik"). Optional only because a SEHAT campaign may have nothing to rule out. */
    ruled_out: z.string().min(1).optional(),
  }),

  /**
   * 2-8 real metrics, most-important first. Every `metric`/`vsContext`/`trendDetail` must cite a
   * real number from the request body — never invented. Minimum is 2 (not the prompt's own "3+"
   * guidance) — there is no retry loop on a schema-validation failure in this codebase (a single
   * OpenAI call, once), so a live over-strict minimum here throws away an otherwise-good real
   * analysis just because the model returned 2 solid bullets instead of 3 for a campaign with
   * genuinely little to report on (e.g. a brand-new, low-data campaign).
   */
  metricBreakdown: z
    .array(
      z.object({
        metric: z.string().min(1),
        status: z.enum(METRIC_STATUSES),
        interpretation: z.string().min(1),
        vsContext: z.string().min(1),
        trend: z.enum(TRENDS),
        trendDetail: z.string().min(1),
      }),
    )
    .min(2)
    .max(8),

  /** 2-4 sentence real narrative of what happened to this specific campaign — not bullet points. */
  whatHappened: z.string().min(1).max(800),

  playbook: z.object({
    immediate: PlaybookStepSchema,
    shortTerm: PlaybookStepSchema,
    mediumTerm: PlaybookStepSchema,
  }),

  kaiDirective: z.object({
    needed: z.boolean(),
    urgency: z.enum(KAI_URGENCIES).optional(),
    /** Specific: how many creatives, which angles, why — required when `needed` is true, omitted when false. */
    brief: z.string().min(1).optional(),
    angles_to_avoid: z.string().min(1).optional(),
    reasoning: z.string().min(1).optional(),
  }),

  budgetDecision: z.object({
    recommendation: z.enum(BUDGET_RECOMMENDATIONS),
    /** Mirrors the request's real `dailyBudget` — the model must not invent a different "current" number. */
    currentBudget: z.number().nonnegative(),
    recommendedBudget: z.number().nonnegative(),
    changePercent: z.number(),
    reasoning: z.string().min(1),
    prerequisite: z.string().min(1).optional(),
    opportunityCost: z.string().min(1).optional(),
  }),

  /**
   * The prompt asks for exactly 2 (the recommended path and one honest alternative), but the
   * schema itself only requires 1-3 — same "no retry loop, don't throw away an otherwise-good
   * real analysis over an off-by-one array length" reasoning as `metricBreakdown`'s own doc.
   * `CampaignInsightPanel`'s rendering only special-cases index 0 as "primary"; any length in
   * this range renders correctly.
   */
  scenarios: z
    .array(
      z.object({
        name: z.string().min(1),
        /** A percentage string, e.g. "70%" — the model's own honest confidence split between the scenarios (should sum to ~100%, enforced by prompt instruction, not schema). */
        probability: z.string().min(1),
        steps: z.array(z.string().min(1)).min(1).max(6),
        expectedOutcome: z.string().min(1),
        timeToResult: z.string().min(1),
        risk: z.string().min(1).optional(),
      }),
    )
    .min(1)
    .max(3),

  /** Optional real context from CPM trend/`marketDigest` — omitted when there is honestly nothing real to say. */
  competitorContext: z.string().min(1).optional(),

  /** 1-2 transferable learnings for OTHER campaigns, derived from this campaign's real data. */
  learnings: z.array(z.string().min(1)).min(1).max(2),

  /** Optional — one non-obvious, senior-level insight. Omitted rather than forced when there's honestly nothing beyond what `rootCause`/`playbook` already said. */
  proTip: z.string().min(1).max(600).optional(),
});
export type CampaignInsightLlmPayload = z.infer<typeof CampaignInsightLlmPayloadSchema>;

export type CampaignInsightResponseDto =
  ({ readonly available: true } & CampaignInsightLlmPayload) | LlmUnavailableResponseDto;

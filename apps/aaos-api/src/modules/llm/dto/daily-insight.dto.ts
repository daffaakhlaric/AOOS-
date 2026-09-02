import { z } from "zod";

import type { LlmUnavailableResponseDto } from "./llm-unavailable.dto.js";

/**
 * `LlmService.generateDailyInsight` request context — AAOS Overview Monitor Phase O1, Finding 4
 * item 2. Composed server-side by `OverviewService.getOverview` from its OWN already-computed real
 * KPI/agent-status/campaign/lead/recycling numbers (the SAME numbers the rest of that one request's
 * `GET /api/v1/overview` response carries) — never a second, independent data pull, and never
 * accepted raw from an HTTP caller (this method has no HTTP endpoint of its own, same "in-process
 * only" precedent `LlmService.selectTargeting`/`generateImprovementPlan` already establish).
 *
 * Deliberately only 3 real agents — SAMANTHA/KAI/CLARA. "Karen" (Webchat) has zero real
 * implementation anywhere in this codebase (`docs/PROMPT-AAOS-OVERVIEW-MONITOR.md` Finding 1) —
 * no schema field here, and the system prompt below never asks the model to say anything about a
 * 4th agent.
 */
const DailyInsightAgentContextSchema = z.object({
  agent: z.enum(["SAMANTHA", "KAI", "CLARA"]),
  /** Real `JudgeResultRepository.getTodayScoreSummary(...).todayAverageOverall` — `null` (never a fabricated number) when this agent has zero real `judge_results` rows today. */
  todayAverageOverall: z.number().nullable(),
  /** Real `...getTodayScoreSummary(...).delta` vs the 7 days before today — `null` when there is nothing real to compare against. */
  delta: z.number().nullable(),
  /** Real count of this agent's `agent_activities` rows in today's real activity feed the overview endpoint already fetched. */
  actionsToday: z.number(),
});

const DailyInsightCampaignsContextSchema = z.object({
  activeCampaignsCount: z.number(),
  totalSpend: z.number(),
  /** The real Meta `datePreset` the campaign pull used (`last_7d`/`last_14d`/`last_30d`) — see `OverviewService`'s own doc for why this is NOT literally "today"'s spend (Meta's real pull has no per-day preset). */
  datePreset: z.string(),
});

const DailyInsightLeadsContextSchema = z.object({
  hot: z.number(),
  warm: z.number(),
  cold: z.number(),
  /** Real count of leads whose `temperature === HOT` and real `becameHotAt` falls on today's UTC calendar day. */
  hotToday: z.number(),
  /** Same real definition, for yesterday's UTC calendar day — the honest "vs yesterday" comparison. */
  hotYesterday: z.number(),
});

const DailyInsightRecyclingContextSchema = z.object({
  sentToday: z.number(),
  respondedToday: z.number(),
  onCooldown: z.number(),
});

export const DailyInsightRequestSchema = z.object({
  tenantId: z.string().min(1),
  /** ISO date (`YYYY-MM-DD`) this insight is FOR — the overview endpoint's own real "today". */
  date: z.string().min(1),
  agents: z.array(DailyInsightAgentContextSchema).length(3),
  /** `null` when the real Meta campaign pull failed for this request (see `OverviewService`'s partial-failure degrade doc) — the prompt is told honestly that campaign data is unavailable rather than being sent a fabricated zeroed object. */
  campaigns: DailyInsightCampaignsContextSchema.nullable(),
  leads: DailyInsightLeadsContextSchema.nullable(),
  recycling: DailyInsightRecyclingContextSchema.nullable(),
});
export type DailyInsightRequestDto = z.infer<typeof DailyInsightRequestSchema>;

/**
 * The shape Samantha's `generate_daily_insight` system prompt asks the model to return — one
 * combined `summary` line (the spec's "Samantha: ... Clara: ... Kai: ..." single-line format) PLUS
 * the same content split per real agent (`perAgent`), so the Overview page's insight bar can render
 * either the combined line or per-agent chips without a second LLM call. Only `samantha`/`kai`/
 * `clara` keys — no `karen` (Finding 1).
 */
export const DailyInsightLlmPayloadSchema = z.object({
  summary: z.string().min(1),
  perAgent: z.object({
    samantha: z.string().min(1),
    kai: z.string().min(1),
    clara: z.string().min(1),
  }),
});
export type DailyInsightLlmPayload = z.infer<typeof DailyInsightLlmPayloadSchema>;

export type DailyInsightResponseDto =
  ({ readonly available: true } & DailyInsightLlmPayload) | LlmUnavailableResponseDto;

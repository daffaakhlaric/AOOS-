import type { ActivityResponseDto } from "../../activity-log/dto/activity-log.dto.js";
import type { DailyInsightResponseDto } from "../../llm/dto/daily-insight.dto.js";
import type { CampaignResponseDto } from "../../meta-ads/dto/campaign-response.dto.js";
import type { HeatmapResponseDto } from "../../meta-ads/dto/heatmap.dto.js";
import type { ObjectiveResponseDto } from "../../objective/dto/objective-response.dto.js";
import type { RecyclingTodaySummary } from "../../recycling/recycling.service.js";

/**
 * `GET /api/v1/overview` response shapes — AAOS Overview Monitor Phase O1 (backend-only; the
 * actual page is Phase O2, later, per `docs/PROMPT-AAOS-OVERVIEW-MONITOR.md`'s own phasing). This
 * endpoint composes 3 genuinely NEW real reads (judge-score-today, recycling-today, the daily LLM
 * insight) with the already-real sources Finding 4 identified (leads, campaigns, objective,
 * activity log, heatmap) into ONE real, `@TenantId()`-scoped aggregate.
 *
 * Every section below is OPTIONAL (`?`/`undefined`) — a real, honest partial-failure degrade
 * (coordinator instruction: "one section's failure doesn't abort the rest", same discipline
 * `SchedulerService`/`CreativePackagesService` already establish elsewhere in this app). When a
 * section's own real sub-source throws, `OverviewService.getOverview` catches it, leaves that
 * field `undefined`, and records a real, honest reason string under `errors[<sectionKey>]` — NEVER
 * a fabricated zero/empty placeholder standing in for real data.
 */

export interface OverviewLeadsSummaryDto {
  /** Real, CURRENT counts by `Lead.temperature` (COLD/WARM/HOT — always one of the 3, distinct from the separate `status` workflow field) across every real branch (`ALL_BRANCH_IDS` fan-out, `RecyclingService.getPool`'s own established pattern). */
  readonly hot: number;
  readonly warm: number;
  readonly cold: number;
  /** Real count of leads whose `temperature === HOT` and real `becameHotAt` falls on today's UTC calendar day — the honest "a lead really became HOT today" signal (`Lead.becameHotAt` is a real, dedicated timestamp; no fabricated proxy off `createdAt`). */
  readonly hotToday: number;
  /** Same real definition, for yesterday's UTC calendar day. */
  readonly hotYesterday: number;
  /** `hotToday - hotYesterday`. */
  readonly hotDeltaVsYesterday: number;
}

export interface OverviewCampaignsSummaryDto {
  readonly adAccountId: string;
  /**
   * The real Meta `datePreset` this pull used (`last_7d`/`last_14d`/`last_30d`) — REAL FINDING
   * correcting the pasted spec's assumed `spendToday`/`avgCplToday` KPI shape: `GET
   * /api/v1/campaigns` (`PullCampaignsQuerySchema`) has no `"today"` `datePreset` option at all —
   * Meta's own real pull is only ever windowed over 7/14/30 days. `totalSpend` below is therefore
   * honestly labeled as spend over THIS window, never presented as literally "spend today".
   */
  readonly datePreset: string;
  readonly activeCampaignsCount: number;
  readonly totalCampaignsCount: number;
  /** Sum of every real campaign's own `spend` in this pull, over `datePreset`'s real window (see this interface's own `datePreset` doc — NOT "today's spend"). */
  readonly totalSpend: number;
  readonly campaigns: readonly CampaignResponseDto[];
}

export interface OverviewAgentScoreDto {
  readonly agent: "SAMANTHA" | "KAI" | "CLARA";
  /** Real `JudgeResultRepository.getTodayScoreSummary(...)` fields — `undefined` (never a fabricated `0`) when this agent has zero real `judge_results` rows in the relevant window. See that method's own doc for the exact real UTC-day window/formula. */
  readonly todayAverageOverall: number | undefined;
  readonly priorSevenDayAverageOverall: number | undefined;
  readonly delta: number | undefined;
  readonly todaySampleSize: number;
  readonly priorSevenDaySampleSize: number;
  /** Real count of this agent's rows in today's real `activities` list below (`agent_activities`, filtered by this agent + today's UTC calendar day). */
  readonly actionsToday: number;
}

export type OverviewRecyclingSummaryDto = RecyclingTodaySummary;

export interface OverviewResponseDto {
  readonly tenantId: string;
  readonly generatedAt: string;

  readonly leads?: OverviewLeadsSummaryDto;
  readonly campaigns?: OverviewCampaignsSummaryDto;
  readonly objective?: ObjectiveResponseDto;
  /** Always exactly 3 entries (SAMANTHA/KAI/CLARA, Finding 2 of the design doc — no "Karen" card, real implementation doesn't exist), each independently degraded (a `todayAverageOverall: undefined` entry for one agent does not remove the other agents' real entries). */
  readonly agentStatus: readonly OverviewAgentScoreDto[];
  readonly recycling?: OverviewRecyclingSummaryDto;
  /** Real `agent_activities` rows, most-recent-first, `GET /api/v1/activity-log`'s own real DTO shape and default 100-row cap (reused in-process here, not a second HTTP round trip — see `OverviewModule`'s own doc). Empty array (never `undefined`) when this section's own real fetch fails — an empty activity feed is itself a real, renderable state, unlike the other sections' summary numbers. */
  readonly activities: readonly ActivityResponseDto[];
  readonly heatmap?: HeatmapResponseDto;
  readonly insight: DailyInsightResponseDto;
  /** Real, honest reason per FAILED section — keyed by `leads`/`campaigns`/`objective`/`agentStatus:<AGENT>`/`recycling`/`activities`/`heatmap`. A section not present here either succeeded or (for `agentStatus`'s per-agent entries) is reported inline. Never includes a section that actually succeeded. */
  readonly errors: Readonly<Record<string, string>>;
}

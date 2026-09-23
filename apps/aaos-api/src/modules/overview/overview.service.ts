import { ALL_BRANCH_IDS } from "@aos/branch-manager";
import { Injectable, Logger } from "@nestjs/common";

import {
  toActivityResponseDto,
  type ActivityResponseDto,
} from "../activity-log/dto/activity-log.dto.js";
import { ActivityRepository } from "../activity-log/infrastructure/activity.repository.js";
import { JudgeResultRepository } from "../ai-judge/infrastructure/judge-result.repository.js";
import type { LeadResponseDto } from "../leads/dto/lead-response.dto.js";
import { LeadsService } from "../leads/leads.service.js";
import { LlmService } from "../llm/llm.service.js";
import { MetaAdsService } from "../meta-ads/meta-ads.service.js";
import { MetaSyncService } from "../meta-sync/meta-sync.service.js";
import { ObjectiveService } from "../objective/objective.service.js";
import { RecyclingService } from "../recycling/recycling.service.js";

import type {
  OverviewAgentScoreDto,
  OverviewCampaignsSummaryDto,
  OverviewLeadsSummaryDto,
  OverviewResponseDto,
} from "./dto/overview-response.dto.js";
import type { OverviewTimeseriesResponseDto } from "./dto/overview-timeseries.dto.js";
import { OverviewSnapshotRepository } from "./infrastructure/overview-snapshot.repository.js";

const JUDGEABLE_AGENTS = ["SAMANTHA", "KAI", "CLARA"] as const;

/** Real Meta `datePreset` used for the Overview page's campaign/spend section — `last_7d`, a closer real proxy for "recent" than the campaigns endpoint's own `last_30d` default (see `OverviewCampaignsSummaryDto.datePreset`'s own doc for why there is no real "today" preset at all). */
const OVERVIEW_CAMPAIGNS_DATE_PRESET = "last_7d" as const;
/** Real Meta `datePreset` used for the Overview page's heatmap-mini section — matches `MetaAdsController.getHeatmap`'s own default window (`last_30d`), since a 7-day window is often too sparse for a meaningful audience×creative grid. */
const OVERVIEW_HEATMAP_DATE_PRESET = "last_30d" as const;
/** Activity feed page size for the Overview page — matches the pasted spec's own "Activities (50 terbaru)" field. */
const OVERVIEW_ACTIVITIES_LIMIT = 50;

/** Start of the caller's real wall-clock UTC day — same convention this app's other "today" aggregations (`sales.service.ts`/`go-live.service.ts`/`JudgeResultRepository.getTodayScoreSummary`/`RecyclingService.getTodaySummary`) already establish. */
function startOfTodayUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
}

function toDateKeyUtc(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * `modules/overview` (AAOS Overview Monitor Phase O1) — `OverviewService.getOverview` composes
 * the 3 genuinely NEW real reads Finding 4 identified (judge-score-today, recycling-today, the
 * daily LLM insight) with the already-real sources (leads, campaigns, objective, activity log,
 * heatmap) into ONE real, `@TenantId()`-scoped aggregate. Real, honest partial-failure degrade
 * throughout — see `OverviewResponseDto`'s own doc: one real sub-source failing (a Meta pull
 * error, the LLM being unavailable, etc.) never aborts the rest of this method; every catch below
 * records a real, honest reason string under `errors[<key>]` and leaves that section `undefined`
 * (never a fabricated placeholder).
 */
@Injectable()
export class OverviewService {
  private readonly logger = new Logger(OverviewService.name);

  constructor(
    private readonly leadsService: LeadsService,
    private readonly metaAdsService: MetaAdsService,
    private readonly objectiveService: ObjectiveService,
    private readonly judgeResultRepository: JudgeResultRepository,
    private readonly recyclingService: RecyclingService,
    private readonly activityRepository: ActivityRepository,
    private readonly llmService: LlmService,
    private readonly overviewSnapshotRepository: OverviewSnapshotRepository,
    /** Real `meta_insights_daily` account-wide daily aggregate — see `getTimeseries`'s own doc. */
    private readonly metaSyncService: MetaSyncService,
  ) {}

  async getOverview(tenantId: string, correlationId: string): Promise<OverviewResponseDto> {
    const now = new Date();
    const errors: Record<string, string> = {};

    // Activities are fetched FIRST (not last) — the daily-insight prompt's `actionsToday` per agent
    // is derived from this SAME real list, per the coordinator instruction that the insight call
    // must be fed real numbers already computed earlier in the same request, never a second,
    // independent data pull.
    const activities = await this.safeFetch("activities", errors, () =>
      this.activityRepository.list(tenantId, { limit: OVERVIEW_ACTIVITIES_LIMIT }),
    );
    const activityDtos: readonly ActivityResponseDto[] = (activities ?? []).map(
      toActivityResponseDto,
    );

    const [leads, campaigns, objective, agentStatus, recycling, heatmap] = await Promise.all([
      this.safeFetch("leads", errors, () => this.getLeadsSummary(tenantId, now)),
      this.safeFetch("campaigns", errors, () => this.getCampaignsSummary(correlationId, tenantId)),
      this.safeFetch("objective", errors, () =>
        Promise.resolve(this.objectiveService.getCurrentObjective()),
      ),
      this.getAgentStatus(tenantId, now, activityDtos, errors),
      this.safeFetch("recycling", errors, () => this.recyclingService.getTodaySummary()),
      this.safeFetch("heatmap", errors, () =>
        this.metaAdsService.getHeatmap(
          { datePreset: OVERVIEW_HEATMAP_DATE_PRESET },
          correlationId,
          tenantId,
        ),
      ),
    ]);

    const insight = await this.generateInsight(
      tenantId,
      now,
      agentStatus,
      leads ?? undefined,
      campaigns ?? undefined,
      recycling ?? undefined,
    );

    return {
      tenantId,
      generatedAt: now.toISOString(),
      leads: leads ?? undefined,
      campaigns: campaigns ?? undefined,
      objective: objective ?? undefined,
      agentStatus,
      recycling: recycling ?? undefined,
      activities: activityDtos,
      heatmap: heatmap ?? undefined,
      insight,
      errors,
    };
  }

  /**
   * Real, CURRENT lead-temperature counts (`Lead.temperature`, distinct from the workflow `status`
   * field — see `OverviewLeadsSummaryDto`'s own doc) fanned out across every real branch, same
   * `ALL_BRANCH_IDS.map(...)` pattern `RecyclingService.getPool`/`LeadsService.getAnalytics`
   * already establish. `hotToday`/`hotYesterday` use each lead's real `becameHotAt` timestamp — a
   * genuine "this lead really became HOT on this UTC calendar day" event, never a proxy off
   * `createdAt` (a lead can be created on one day and become HOT days later).
   */
  private async getLeadsSummary(tenantId: string, now: Date): Promise<OverviewLeadsSummaryDto> {
    const perBranch = await Promise.all(
      ALL_BRANCH_IDS.map((branchId) => this.leadsService.getLeadsByBranch({ branchId }, tenantId)),
    );
    const leads: readonly LeadResponseDto[] = perBranch.flat();

    const todayKey = toDateKeyUtc(startOfTodayUtc(now).toISOString());
    const yesterdayKey = toDateKeyUtc(
      new Date(startOfTodayUtc(now).getTime() - 24 * 60 * 60 * 1000).toISOString(),
    );

    let hot = 0;
    let warm = 0;
    let cold = 0;
    let hotToday = 0;
    let hotYesterday = 0;
    for (const lead of leads) {
      if (lead.temperature === "HOT") {
        hot += 1;
        if (lead.becameHotAt !== undefined) {
          const key = toDateKeyUtc(lead.becameHotAt);
          if (key === todayKey) {
            hotToday += 1;
          } else if (key === yesterdayKey) {
            hotYesterday += 1;
          }
        }
      } else if (lead.temperature === "WARM") {
        warm += 1;
      } else if (lead.temperature === "COLD") {
        cold += 1;
      }
    }

    return {
      hot,
      warm,
      cold,
      hotToday,
      hotYesterday,
      hotDeltaVsYesterday: hotToday - hotYesterday,
    };
  }

  /**
   * Real campaign/spend summary, reusing `MetaAdsService.pullCampaigns` in-process (the SAME real
   * pull `MetaAdsController.getCampaigns` performs — never a second, parallel Meta pull path).
   *
   * REAL BUG FIX (reported live: "campaign aktif tidak muncul di overview padahal di Meta Ads
   * banyak campaign aktif"): this used to call `pullCampaigns` with no `adAccountId`, which falls
   * back to ONLY the connector's first configured ad account (`MetaAdsService.pullAdAccount`'s own
   * `connector.adAccountIds[0]` default) — silently missing every active campaign under any OTHER
   * configured account for a real multi-ad-account tenant (a real, supported scenario — see
   * `getAdAccounts`'s own doc, which already powers the Campaigns page's multi-account pill
   * selector). Now aggregates across EVERY real configured ad account, matching what a manager
   * actually sees when they open Meta Ads Manager directly.
   */
  private async getCampaignsSummary(
    correlationId: string,
    tenantId: string,
  ): Promise<OverviewCampaignsSummaryDto> {
    const accounts = await this.metaAdsService.getAdAccounts(tenantId);

    // Honest fallback matching the old single-account behavior when the connector genuinely has no
    // enumerable accounts (should not happen in practice — `pullCampaigns` throws its own real
    // `ValidationError` in that case, which this method does not swallow).
    const adAccountIds = accounts.length > 0 ? accounts.map((account) => account.id) : [undefined];

    // `MetaAdsService.pullCampaigns` already returns the real, JSON-serializable
    // `AdAccountResponseDto` (it calls `toAdAccountResponseDto` internally) — reused AS-IS here,
    // never re-converted a second time. Pulled in parallel — each is an independent real Meta call
    // scoped to its own account, no shared state between them.
    const perAccountDtos = await Promise.all(
      adAccountIds.map((adAccountId) =>
        this.metaAdsService.pullCampaigns(
          {
            datePreset: OVERVIEW_CAMPAIGNS_DATE_PRESET,
            ...(adAccountId !== undefined ? { adAccountId } : {}),
          },
          correlationId,
          tenantId,
        ),
      ),
    );

    const campaigns = perAccountDtos.flatMap((dto) => dto.campaigns);
    const activeCampaignsCount = campaigns.filter((c) => c.status === "ACTIVE").length;
    const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
    return {
      adAccountId: perAccountDtos[0]?.id ?? "",
      datePreset: OVERVIEW_CAMPAIGNS_DATE_PRESET,
      activeCampaignsCount,
      totalCampaignsCount: campaigns.length,
      totalSpend,
      campaigns,
    };
  }

  /**
   * Real judge-score-today per agent (Finding 4 item 1), for the 3 real agents only (SAMANTHA/KAI/
   * CLARA — no "Karen" card, Finding 2). Each agent's fetch is independently caught, keyed
   * `agentStatus:<AGENT>` in `errors`, so one agent's real query failure never removes the other 2
   * agents' real entries — same partial-failure discipline as every other section.
   */
  private async getAgentStatus(
    tenantId: string,
    now: Date,
    activities: readonly ActivityResponseDto[],
    errors: Record<string, string>,
  ): Promise<readonly OverviewAgentScoreDto[]> {
    const todayKey = toDateKeyUtc(startOfTodayUtc(now).toISOString());
    const actionsTodayByAgent = new Map<string, number>();
    for (const activity of activities) {
      if (toDateKeyUtc(activity.startedAt) === todayKey) {
        actionsTodayByAgent.set(activity.agent, (actionsTodayByAgent.get(activity.agent) ?? 0) + 1);
      }
    }

    const entries = await Promise.all(
      JUDGEABLE_AGENTS.map(async (agent): Promise<OverviewAgentScoreDto> => {
        const actionsToday = actionsTodayByAgent.get(agent) ?? 0;
        try {
          const summary = await this.judgeResultRepository.getTodayScoreSummary(
            tenantId,
            agent,
            now,
          );
          return {
            agent,
            todayAverageOverall: summary.todayAverageOverall,
            priorSevenDayAverageOverall: summary.priorSevenDayAverageOverall,
            delta: summary.delta,
            todaySampleSize: summary.todaySampleSize,
            priorSevenDaySampleSize: summary.priorSevenDaySampleSize,
            actionsToday,
          };
        } catch (caught) {
          const reason = caught instanceof Error ? caught.message : String(caught);
          errors[`agentStatus:${agent}`] = reason;
          this.logger.warn(`OverviewService.getAgentStatus(${agent}) failed: ${reason}`);
          return {
            agent,
            todayAverageOverall: undefined,
            priorSevenDayAverageOverall: undefined,
            delta: undefined,
            todaySampleSize: 0,
            priorSevenDaySampleSize: 0,
            actionsToday,
          };
        }
      }),
    );
    return entries;
  }

  /**
   * Real daily-insight generation (Finding 4 item 2) — fed EXCLUSIVELY by this SAME request's own
   * already-computed real numbers (`agentStatus`/`leads`/`campaigns`/`recycling`, all built earlier
   * in `getOverview` above), never a second, independent data pull. A section that failed upstream
   * (`undefined` here) is sent as a real, honest `null` in the LLM request body — see
   * `DailyInsightRequestDto`'s own doc — never a fabricated zeroed object.
   */
  private async generateInsight(
    tenantId: string,
    now: Date,
    agentStatus: readonly OverviewAgentScoreDto[],
    leads: OverviewLeadsSummaryDto | undefined,
    campaigns: OverviewCampaignsSummaryDto | undefined,
    recycling: OverviewResponseDto["recycling"],
  ) {
    return this.llmService.generateDailyInsight(tenantId, {
      tenantId,
      date: toDateKeyUtc(now.toISOString()),
      agents: agentStatus.map((entry) => ({
        agent: entry.agent,
        todayAverageOverall: entry.todayAverageOverall ?? null,
        delta: entry.delta ?? null,
        actionsToday: entry.actionsToday,
      })),
      campaigns:
        campaigns === undefined
          ? null
          : {
              activeCampaignsCount: campaigns.activeCampaignsCount,
              totalSpend: campaigns.totalSpend,
              datePreset: campaigns.datePreset,
            },
      leads:
        leads === undefined
          ? null
          : {
              hot: leads.hot,
              warm: leads.warm,
              cold: leads.cold,
              hotToday: leads.hotToday,
              hotYesterday: leads.hotYesterday,
            },
      recycling:
        recycling === undefined
          ? null
          : {
              sentToday: recycling.sentToday,
              respondedToday: recycling.respondedToday,
              onCooldown: recycling.onCooldown,
            },
    });
  }

  /**
   * `GET /api/v1/overview/timeseries` — Command Center "Performance Overview" chart + the KPI
   * strip's sparklines.
   *
   * REAL BUG FIX (observed live, 2026-09-21): this read ONLY `overview_daily_snapshots`
   * (`OverviewSnapshotCronService`'s daily writer), which had produced ZERO rows for the real
   * tenant — so every trend surface was stuck on its honest "not enough history" state even though
   * `meta_insights_daily` already held real per-day rows (verified live: 2026-09-15 onward).
   *
   * Now prefers the real `meta_insights_daily` account-wide aggregate
   * (`MetaSyncService.getAccountDailyHistory`, summed per date over `level = 'campaign'` rows only)
   * and falls back to `overview_daily_snapshots` when that genuinely has no rows — so a tenant whose
   * Meta sync hasn't run but whose snapshot cron HAS still gets its real history, and neither source
   * silently masks the other being empty.
   *
   * HONEST SEMANTIC NOTE on `totalLeads`: the `meta_insights_daily` path reports Meta's own
   * ad-conversion lead count, which is exactly what the KPI strip's own "Raw Leads" figure already
   * shows (summed `ad.metrics.totalLead`), so the sparkline is consistent with the number it sits
   * under. It is NOT this app's CRM lead count (`overview_daily_snapshots.total_leads`, which is
   * `hot + warm + cold` from the lead store) — the two are deliberately different figures, per
   * `059_overview_daily_snapshots.sql`'s own header. The CRM-backed "Hot Leads" KPI deliberately
   * gets NO sparkline for that reason.
   *
   * An empty array remains a real, honest result (never fabricated) when neither source has rows.
   */
  async getTimeseries(tenantId: string, days: number): Promise<OverviewTimeseriesResponseDto> {
    const daily = await this.metaSyncService.getAccountDailyHistory(tenantId, days);
    if (daily.length > 0) {
      return {
        tenantId,
        points: daily.map((row) => ({
          date: row.date,
          totalSpend: row.spend,
          totalLeads: row.leads,
        })),
      };
    }

    const points = await this.overviewSnapshotRepository.listRecent(tenantId, days);
    return { tenantId, points };
  }

  /** Shared "run this real fetch, catch any real failure, record it honestly" wrapper — the ONE place `getOverview`'s partial-failure degrade discipline is implemented, so every section follows it identically. Returns `undefined` (never a fabricated placeholder) on failure. */
  private async safeFetch<T>(
    key: string,
    errors: Record<string, string>,
    fetcher: () => Promise<T>,
  ): Promise<T | undefined> {
    try {
      return await fetcher();
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : String(caught);
      errors[key] = reason;
      this.logger.warn(`OverviewService.getOverview: section "${key}" failed: ${reason}`);
      return undefined;
    }
  }
}

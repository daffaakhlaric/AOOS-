import { randomUUID } from "node:crypto";

import { ALL_BRANCH_IDS } from "@aos/branch-manager";
import { NotFoundError } from "@aos/errors";
import type { IPublisher } from "@aos/event-bus";
import type { LeadStore } from "@aos/lead-store";
import {
  ConfidenceScore,
  DEFAULT_META_ADS_AGENT_CONFIG,
  DigestService,
  ExecutionPlanBuilder,
  MetaAdsAgentEvents,
  OptimizationPipeline,
  VerdictDecisionEngine,
  type MetaAdsAgentConfig,
  type PerAdFinding,
} from "@aos/meta-ads-agent";
import {
  AdAccountId,
  MetaAdsSyncService,
  Verdict,
  type Ad,
  type AdAccount,
  type MetaAdsConnector,
} from "@aos/meta-ads-connector";
import type { MobixScraperService } from "@aos/mobix-web-scraper";
import type { ObjectiveEngine } from "@aos/objective-engine";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import {
  AAOS_API_CONFIG,
  EVENT_PUBLISHER,
  LEAD_STORE,
  META_ADS_CONNECTOR,
  MOBIX_SCRAPER_SERVICE,
  OBJECTIVE_ENGINE,
} from "../../di-tokens.js";
import type { AnalyzeRequestDto } from "../llm/dto/analyze.dto.js";
import { LlmService } from "../llm/llm.service.js";
import { RecyclingService } from "../recycling/recycling.service.js";

import type { CalendarEventResult, StoredCalendarEvent } from "./domain/calendar-event.js";
import { isSupportedCalendarEventType } from "./domain/calendar-event.js";
import type {
  CreateCalendarEventBodyDto,
  GetCalendarQueryDto,
  UpdateCalendarEventBodyDto,
} from "./dto/calendar-event.dto.js";
import { CalendarEventRepository } from "./infrastructure/calendar-event.repository.js";

/** How far back `checkAndRunDueEvents` looks for a `PENDING` event it might have missed on a prior tick — matches the spec's own 1-minute cron cadence. */
const DUE_WINDOW_MS = 60_000;

/** `PullCampaignData`'s Meta date preset — matches `apps/aaos-dashboard`'s own default (`PullCampaignsQuerySchema`). */
const DEFAULT_DATE_PRESET = "last_30d";

/**
 * Drives the "Kalender Aktivitas Tamara & Kai" widget's backend (AAOS-KALENDER-AKTIVITAS).
 *
 * SCOPE (see `docs/PROMPT-AAOS-KALENDER-AKTIVITAS.md`'s COORDINATOR NOTE): only 5 of the spec's
 * 14 proposed event types are implemented — `SCRAPER_RUN`, `TAMARA_PULL_DATA`, `TAMARA_ANALYZE`,
 * `KAI_REFRESH_CHECK`, `DAILY_DIGEST`. The other 9 (6 campaign-mutating types with no
 * human-approval gate at execution time, plus 3 with zero real backing anywhere in this codebase)
 * have no `case` in `executeEvent`'s switch — a stray row with one of them is marked `FAILED` with
 * an honest "event type tidak didukung" message rather than silently ignored or throwing unhandled.
 *
 * Every handler here is read-only with respect to real Meta campaigns/Kie AI credits: none of them
 * calls `ExecuteVerdict`, creates/activates/pauses a campaign, or generates real creative — that
 * remains entirely out of scope for this pass (coordinator note section 7).
 */
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly metaAdsSyncService: MetaAdsSyncService;

  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(META_ADS_CONNECTOR) private readonly connector: MetaAdsConnector,
    @Inject(MOBIX_SCRAPER_SERVICE) private readonly scraper: MobixScraperService,
    @Inject(OBJECTIVE_ENGINE) private readonly objectiveEngine: ObjectiveEngine,
    @Inject(LEAD_STORE) private readonly leadStore: LeadStore,
    @Inject(EVENT_PUBLISHER) private readonly publisher: IPublisher,
    private readonly llmService: LlmService,
    private readonly repository: CalendarEventRepository,
    private readonly recyclingService: RecyclingService,
  ) {
    this.metaAdsSyncService = new MetaAdsSyncService(this.connector.pullCampaignData);
  }

  /** Checked every minute (spec: `@Cron('* * * * *')`) — every `PENDING` event due within the last minute is run, detached, so a slow handler never blocks the next tick. */
  @Cron("* * * * *")
  async checkAndRunDueEvents(): Promise<void> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - DUE_WINDOW_MS);
    const dueEvents = await this.repository.listDuePending(
      this.config.AAOS_TENANT_ID,
      windowStart.toISOString(),
      now.toISOString(),
    );
    for (const event of dueEvents) {
      this.executeEvent(event).catch((caught) => {
        this.logger.error(
          `SchedulerService.checkAndRunDueEvents: executeEvent(${event.id}) rejected: ${String(caught)}`,
        );
      });
    }
  }

  async executeEvent(event: StoredCalendarEvent): Promise<void> {
    const startedAt = new Date();
    await this.repository.markRunning(event.id, startedAt.toISOString());
    const correlationId = randomUUID();

    if (!isSupportedCalendarEventType(event.eventType)) {
      await this.repository.markFailed(
        event.id,
        new Date().toISOString(),
        Date.now() - startedAt.getTime(),
        `Event type "${event.eventType}" tidak didukung.`,
      );
      return;
    }

    try {
      let result: CalendarEventResult;
      switch (event.eventType) {
        case "SCRAPER_RUN":
          result = await this.runScraperRun();
          break;
        case "TAMARA_PULL_DATA":
          result = await this.runTamaraPullData(correlationId);
          break;
        case "TAMARA_ANALYZE":
          result = await this.runTamaraAnalyze(correlationId);
          break;
        case "KAI_REFRESH_CHECK":
          result = await this.runKaiRefreshCheck(correlationId);
          break;
        case "DAILY_DIGEST":
          result = await this.runDailyDigest(correlationId);
          break;
        case "RECYCLING_RUN":
          result = await this.runRecyclingRun(correlationId);
          break;
      }

      const durationMs = Date.now() - startedAt.getTime();
      await this.repository.markDone(event.id, new Date().toISOString(), durationMs, result);

      if (event.recurrence !== "ONCE") {
        await this.scheduleNext(event);
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      this.logger.error(`SchedulerService.executeEvent(${event.id}) failed: ${message}`);
      await this.repository.markFailed(
        event.id,
        new Date().toISOString(),
        Date.now() - startedAt.getTime(),
        message,
      );
    }
  }

  /** `POST /api/v1/calendar/:id/run-now` — runs immediately regardless of `scheduledAt`. */
  async runNow(id: string): Promise<StoredCalendarEvent> {
    const event = await this.findOrThrow(id);
    await this.executeEvent(event);
    return this.findOrThrow(id);
  }

  /** `POST /api/v1/calendar/:id/skip` — marks skipped and, for a recurring event, schedules the next occurrence. */
  async skip(id: string): Promise<StoredCalendarEvent> {
    const event = await this.findOrThrow(id);
    await this.repository.markSkipped(id);
    if (event.recurrence !== "ONCE") {
      await this.scheduleNext(event);
    }
    return this.findOrThrow(id);
  }

  private async findOrThrow(id: string): Promise<StoredCalendarEvent> {
    const event = await this.repository.findById(id);
    if (event === undefined) {
      throw new NotFoundError(`No calendar event found with id "${id}"`);
    }
    return event;
  }

  // ---------------------------------------------------------------------------------------------
  // CRUD — `GET/POST/PUT/DELETE /api/v1/calendar*`.
  // ---------------------------------------------------------------------------------------------

  /** `GET /api/v1/calendar?range=this_week` or `?month=YYYY-MM`. */
  async listEvents(query: GetCalendarQueryDto): Promise<readonly StoredCalendarEvent[]> {
    const { from, to } = resolveCalendarRange(query, new Date());
    return this.repository.listByRange(this.config.AAOS_TENANT_ID, from, to);
  }

  /** `POST /api/v1/calendar` — the "Tambah Jadwal" modal's payload, already narrowed by `CreateCalendarEventBodySchema` to one of the 5 supported event types. */
  async createEvent(body: CreateCalendarEventBodyDto): Promise<StoredCalendarEvent> {
    return this.repository.create({
      id: randomUUID(),
      tenantId: this.config.AAOS_TENANT_ID,
      eventType: body.eventType,
      title: body.title,
      ...(body.description !== undefined ? { description: body.description } : {}),
      scheduledAt: body.scheduledAt,
      recurrence: body.recurrence,
      ...(body.recurrenceDays !== undefined ? { recurrenceDays: body.recurrenceDays } : {}),
      ...(body.recurrenceTime !== undefined ? { recurrenceTime: body.recurrenceTime } : {}),
      ...(body.metadata !== undefined ? { metadata: body.metadata } : {}),
      ...(body.targetId !== undefined ? { targetId: body.targetId } : {}),
      ...(body.targetName !== undefined ? { targetName: body.targetName } : {}),
      createdBy: "manager",
    });
  }

  /** `PUT /api/v1/calendar/:id` — only the supplied fields are patched. */
  async updateEvent(id: string, body: UpdateCalendarEventBodyDto): Promise<StoredCalendarEvent> {
    await this.findOrThrow(id);
    await this.repository.update(id, body);
    return this.findOrThrow(id);
  }

  /** `DELETE /api/v1/calendar/:id`. */
  async removeEvent(id: string): Promise<void> {
    await this.findOrThrow(id);
    await this.repository.delete(id);
  }

  // ---------------------------------------------------------------------------------------------
  // Handlers — one per supported event type. Each fetches REAL data via an already-composed
  // package capability; none fabricates a count or executes a campaign mutation.
  // ---------------------------------------------------------------------------------------------

  /** `SCRAPER_RUN` — the existing `RunFullScrape` use case, already wired via `MOBIX_SCRAPER_SERVICE` (`modules/scraper`'s own composition). */
  private async runScraperRun(): Promise<CalendarEventResult> {
    const jobId = randomUUID();
    const result = await this.scraper.runFullScrape(jobId);
    if (!result.ok) {
      throw new Error(result.error.message);
    }
    const units = result.value.session.units.length;
    const photosStored = result.value.photoResults.reduce(
      (sum, batch) => sum + batch.succeeded.length,
      0,
    );
    return {
      summary: `${String(units)} unit · ${String(photosStored)} foto`,
      units,
      newUnits: result.value.diff.newUnits.length,
      soldUnits: result.value.diff.soldUnits.length,
      photosStored,
    };
  }

  /** `TAMARA_PULL_DATA` — `PullCampaignData` orchestrated by `MetaAdsSyncService` across every configured ad account (coordinator note section 1). */
  private async runTamaraPullData(correlationId: string): Promise<CalendarEventResult> {
    const adAccounts = await this.pullAdAccounts(correlationId);
    const campaigns = adAccounts.reduce((sum, account) => sum + account.campaigns.length, 0);
    const ads = adAccounts.reduce((sum, account) => sum + countAds(account), 0);
    return {
      summary: `${String(campaigns)} kampanye · ${String(ads)} iklan`,
      campaigns,
      ads,
      adAccounts: adAccounts.length,
    };
  }

  /**
   * `TAMARA_ANALYZE` — new orchestration glue (coordinator note section 6): fetches the tenant's
   * active campaigns itself, calls the real `LlmService.analyze`, and always ALSO aggregates a
   * rule-based PAUSE/SCALE count directly from each ad's already-computed `verdict` (set by
   * `@aos/meta-ads-connector`'s own `evaluateVerdict` during the pull above) — this is the "rule-based
   * fallback path" the coordinator note refers to, and it is computed unconditionally (not only
   * when the LLM is unavailable) so the digest-style summary is always a real, deterministic count.
   */
  private async runTamaraAnalyze(correlationId: string): Promise<CalendarEventResult> {
    const adAccounts = await this.pullAdAccounts(correlationId);
    const allAds = adAccounts.flatMap((account) => flattenAds(account));
    const campaigns = adAccounts.reduce((sum, account) => sum + account.campaigns.length, 0);
    const pause = allAds.filter((ad) => ad.verdict === Verdict.PAUSE).length;
    const scale = allAds.filter((ad) => ad.verdict === Verdict.SCALE).length;

    const analyzePayload: AnalyzeRequestDto = { campaigns: toAnalyzeCampaigns(adAccounts) };
    const analysis =
      analyzePayload.campaigns.length > 0
        ? await this.llmService.analyze(analyzePayload)
        : undefined;

    return {
      summary: `${String(campaigns)} kamp · ${String(pause)} PAUSE · ${String(scale)} SCALE`,
      campaigns,
      totalAds: allAds.length,
      pause,
      scale,
      aiAvailable: analysis?.available ?? false,
    };
  }

  /**
   * `KAI_REFRESH_CHECK` — maps to the `REFRESH` verdict already produced by
   * `VerdictDecisionEngine` (coordinator note section 1): pulls campaigns, runs them through the
   * real `OptimizationPipeline`/`VerdictDecisionEngine` (read-only — no `AUTO_EXECUTE`/`BRIEF_KAI`
   * side effects are actually invoked here, only the decision classification), and counts how many
   * ads decided `REFRESH`. Never calls `GenerateCreativeBrief`/Kie AI itself (that remains
   * `KAI_GENERATE`, excluded per coordinator note section 1 round 1).
   */
  private async runKaiRefreshCheck(correlationId: string): Promise<CalendarEventResult> {
    const adAccounts = await this.pullAdAccounts(correlationId);
    const pipeline = new OptimizationPipeline();
    const verdictEngine = new VerdictDecisionEngine();
    const agentConfig: MetaAdsAgentConfig = {
      ...DEFAULT_META_ADS_AGENT_CONFIG,
      tenantId: this.config.AAOS_TENANT_ID,
    };
    const confidenceResult = ConfidenceScore.create(70);
    if (!confidenceResult.ok) {
      /* v8 ignore next */
      throw confidenceResult.error;
    }

    let refreshNeeded = 0;
    const refreshedAdNames: string[] = [];
    for (const account of adAccounts) {
      if (account.campaigns.length === 0) {
        continue;
      }
      const analyzed = pipeline.analyze(account);
      if (!analyzed.ok) {
        continue;
      }
      for (const finding of analyzed.value.adFindings) {
        const decision = verdictEngine.decideForAd(
          finding,
          analyzed.value.avgRphChatIDR,
          agentConfig,
          confidenceResult.value,
        );
        if (decision.ok && decision.value.actionKind === "REFRESH") {
          refreshNeeded += 1;
          refreshedAdNames.push(finding.unit);
        }
      }
    }

    return {
      summary:
        refreshNeeded > 0
          ? `${String(refreshNeeded)} iklan jenuh → brief ke Kai`
          : "Tidak ada iklan jenuh",
      refreshNeeded,
      ads: refreshedAdNames,
    };
  }

  /**
   * `DAILY_DIGEST` — genuinely new wiring (coordinator note section 2): the first caller anywhere
   * in `apps/` of `@aos/meta-ads-agent`'s real `DigestService`/`DailyDigestBuilder`. Builds an
   * intentionally EMPTY `ExecutionPlan` (zero decisions) rather than running the full optimization
   * cycle, since that would execute real `AUTO_EXECUTE` decisions against the live Meta API — out
   * of scope for a calendar-scheduled digest. `creativeBriefs`/`escalations` are empty for the same
   * reason. Every number the digest itself reports (hot leads, budget, top performers) is real,
   * derived from the real `Objective`/pulled `AdAccount` — nothing here is fabricated.
   *
   * Does NOT touch `apps/aaos-dashboard`'s existing client-side `<TamaraDigest />` — a separate,
   * unrelated component (coordinator note section 2).
   */
  private async runDailyDigest(correlationId: string): Promise<CalendarEventResult> {
    const objectives = this.objectiveEngine.registry.listByTenant(this.config.AAOS_TENANT_ID);
    const objective = [...objectives].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )[0];
    if (objective === undefined) {
      throw new Error(
        `Belum ada Objective aktif untuk tenant "${this.config.AAOS_TENANT_ID}" — Daily Digest butuh Objective bulan berjalan.`,
      );
    }

    const adAccounts = await this.pullAdAccounts(correlationId);
    const adAccount = adAccounts[0];
    if (adAccount === undefined) {
      throw new Error("Tidak ada AdAccount yang berhasil ditarik untuk Daily Digest.");
    }

    const hotLeadsCount = await this.countHotLeads();

    const progressResult = await this.objectiveEngine.updateProgress.execute({
      objectiveId: objective.id,
      adAccount,
      hotLeadsCount,
      correlationId,
    });
    if (!progressResult.ok) {
      throw new Error(progressResult.error.message);
    }

    const pipeline = new OptimizationPipeline();
    const analyzed = pipeline.analyze(adAccount);
    const adFindings: readonly PerAdFinding[] = analyzed.ok ? analyzed.value.adFindings : [];

    const planResult = ExecutionPlanBuilder.build(this.config.AAOS_TENANT_ID, [], new Date());
    if (!planResult.ok) {
      throw new Error(planResult.error.message);
    }

    const digestService = new DigestService(new MetaAdsAgentEvents(this.publisher));
    const digestResult = await digestService.generate(
      {
        tenantId: this.config.AAOS_TENANT_ID,
        date: new Date(),
        targetHotLeads: objective.targetHotLeads.toNumber(),
        budgetAllocationIDR: objective.budgetAllocation.toNumber(),
        progress: progressResult.value,
        plan: planResult.value,
        creativeBriefs: [],
        escalations: [],
        adFindings,
      },
      correlationId,
    );
    if (!digestResult.ok) {
      throw new Error(digestResult.error.message);
    }
    const digest = digestResult.value;

    return {
      summary: `Hot leads ${String(digest.currentHotLeads)}/${String(digest.targetHotLeads)} (${String(digest.progressPercentage)}%)`,
      currentHotLeads: digest.currentHotLeads,
      targetHotLeads: digest.targetHotLeads,
      progressPercentage: digest.progressPercentage,
      budgetSpentPercentage: digest.budgetSpentPercentage,
      text: digest.text,
    };
  }

  /**
   * `RECYCLING_RUN` (AAOS-LEAD-RECYCLING-BROADCAST, coordinator note section 7) — the REAL daily
   * auto-broadcast mechanism, dispatched by this same due-window cron rather than a second,
   * parallel `@Cron`. Delegates every real decision (Auto Mode check, pool query, cooldown/hours
   * filtering, sending) to `RecyclingService.runRecyclingRun`, which returns an honest summary —
   * never a fabricated count.
   */
  private async runRecyclingRun(correlationId: string): Promise<CalendarEventResult> {
    const result = await this.recyclingService.runRecyclingRun(correlationId);
    return {
      summary: result.summary,
      attempted: result.attempted,
      sent: result.sent,
      failed: result.failed,
    };
  }

  /** Sum of real `HOT`-status leads across every branch (`@aos/lead-store`'s `GetHotLeads`, per branch — there is no tenant-wide aggregate use case). A branch whose lookup fails contributes 0 and is logged, never aborts the whole digest. */
  private async countHotLeads(): Promise<number> {
    let total = 0;
    for (const branchId of ALL_BRANCH_IDS) {
      const result = await this.leadStore.getHotLeads.execute(branchId);
      if (result.ok) {
        total += result.value.length;
      } else {
        this.logger.warn(
          `SchedulerService.countHotLeads: getHotLeads(${branchId}) failed: ${result.error.message}`,
        );
      }
    }
    return total;
  }

  /** Pulls every configured ad account's real campaign hierarchy (`MetaAdsSyncService.syncAccounts` — one `PullCampaignData` call per account, independent failures). Throws only when EVERY account failed. */
  private async pullAdAccounts(correlationId: string): Promise<readonly AdAccount[]> {
    const inputs = this.config.META_AD_ACCOUNT_IDS.map((rawId) => {
      const idResult = AdAccountId.create(rawId);
      if (!idResult.ok) {
        throw idResult.error;
      }
      return {
        adAccountId: idResult.value,
        datePreset: DEFAULT_DATE_PRESET,
        accessToken: this.config.META_ACCESS_TOKEN,
        tenantId: this.config.AAOS_TENANT_ID,
        correlationId,
      } as const;
    });

    const results = await this.metaAdsSyncService.syncAccounts(inputs);
    const adAccounts: AdAccount[] = [];
    const errors: string[] = [];
    for (const result of results) {
      if (result.ok) {
        adAccounts.push(result.value);
      } else {
        errors.push(result.error.message);
      }
    }
    if (adAccounts.length === 0) {
      throw new Error(
        `Gagal menarik data dari semua ad account: ${errors.join("; ") || "unknown error"}`,
      );
    }
    return adAccounts;
  }

  /** Computes and persists the next occurrence for a recurring event (spec: `scheduleNext`). */
  private async scheduleNext(event: StoredCalendarEvent): Promise<void> {
    const next = nextOccurrence(event);
    if (next === undefined) {
      return;
    }
    await this.repository.create({
      id: randomUUID(),
      tenantId: event.tenantId,
      eventType: event.eventType,
      title: event.title,
      ...(event.description !== undefined ? { description: event.description } : {}),
      scheduledAt: next.toISOString(),
      timezone: event.timezone,
      recurrence: event.recurrence,
      ...(event.recurrenceDays !== undefined ? { recurrenceDays: event.recurrenceDays } : {}),
      ...(event.recurrenceTime !== undefined ? { recurrenceTime: event.recurrenceTime } : {}),
      ...(event.targetId !== undefined ? { targetId: event.targetId } : {}),
      ...(event.targetName !== undefined ? { targetName: event.targetName } : {}),
      ...(event.metadata !== undefined ? { metadata: event.metadata } : {}),
      createdBy: "system",
      parentEventId: event.id,
    });
  }
}

/** Pure — resolves `GetCalendarQueryDto` into an ISO `[from, to]` bound for `CalendarEventRepository.listByRange`. `this_week`: today 00:00 through the end of the current ISO week (Sunday 23:59:59.999), both UTC. `month=YYYY-MM`: the first through last instant of that calendar month, UTC. */
export function resolveCalendarRange(
  query: GetCalendarQueryDto,
  now: Date,
): { readonly from: string; readonly to: string } {
  if (query.month !== undefined) {
    const [yearRaw, monthRaw] = query.month.split("-");
    const year = Number(yearRaw);
    const monthIndex = Number(monthRaw) - 1;
    const from = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
    const to = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
    return { from: from.toISOString(), to: to.toISOString() };
  }

  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
  );
  const daysUntilSunday = 7 - isoWeekday(todayStart);
  const weekEnd = addDays(todayStart, daysUntilSunday);
  const to = new Date(
    Date.UTC(
      weekEnd.getUTCFullYear(),
      weekEnd.getUTCMonth(),
      weekEnd.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
  return { from: todayStart.toISOString(), to: to.toISOString() };
}

/** Pure — the next `scheduled_at` for a recurring event, per the spec's `scheduleNext`/`nextWeeklyOccurrence`. `undefined` for `ONCE` (never recurs) or an event whose `recurrenceDays` is empty/missing on `WEEKLY` (nothing to advance to). */
export function nextOccurrence(event: StoredCalendarEvent): Date | undefined {
  const previous = new Date(event.scheduledAt);
  switch (event.recurrence) {
    case "DAILY":
      return addDays(previous, 1);
    case "WEEKLY":
      return nextWeeklyOccurrence(previous, event.recurrenceDays);
    case "MONTHLY":
      return addMonths(previous, 1);
    case "ONCE":
    default:
      return undefined;
  }
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

/** ISO weekday numbers, 1 (Senin) .. 7 (Minggu) — matches the spec's `DAYS` picker. `Date.getUTCDay()` returns 0 (Sunday) .. 6 (Saturday), remapped here. */
function isoWeekday(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

function nextWeeklyOccurrence(
  previous: Date,
  recurrenceDays: readonly number[] | undefined,
): Date | undefined {
  if (recurrenceDays === undefined || recurrenceDays.length === 0) {
    return undefined;
  }
  const sortedDays = [...recurrenceDays].sort((a, b) => a - b);
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = addDays(previous, offset);
    if (sortedDays.includes(isoWeekday(candidate))) {
      return candidate;
    }
  }
  /* v8 ignore next -- unreachable: recurrenceDays is non-empty and every value is 1-7, so the loop above always finds a match within 7 days. */
  return undefined;
}

function flattenAds(account: AdAccount): Ad[] {
  const ads: Ad[] = [];
  for (const campaign of account.campaigns) {
    for (const adSet of campaign.adSets) {
      for (const ad of adSet.ads) {
        ads.push(ad);
      }
    }
  }
  return ads;
}

function countAds(account: AdAccount): number {
  return flattenAds(account).length;
}

function toAnalyzeCampaigns(adAccounts: readonly AdAccount[]): AnalyzeRequestDto["campaigns"] {
  return adAccounts.flatMap((account) =>
    account.campaigns.map((campaign) => ({
      id: campaign.id.toString(),
      stableId: campaign.stableId.toString(),
      name: campaign.name,
      objective: campaign.objective,
      status: campaign.status,
      spend: campaign.spend.toNumber(),
      adSets: campaign.adSets.map((adSet) => ({
        id: adSet.id.toString(),
        stableId: adSet.stableId.toString(),
        name: adSet.name,
        status: adSet.status,
        spend: adSet.spend.toNumber(),
        ads: adSet.ads.map((ad) => ({
          id: ad.id.toString(),
          stableId: ad.stableId.toString(),
          name: ad.name,
          status: ad.status,
          funnel: ad.funnel,
          branch: ad.branch,
          verdict: ad.verdict,
          metrics: {
            spend: ad.metrics.spend.toNumber(),
            frequency: ad.metrics.frequency,
            clicks: ad.metrics.clicks,
            conversations: ad.metrics.conversations,
            d2: ad.metrics.d2,
            d3: ad.metrics.d3,
            d5: ad.metrics.d5,
            leadForm: ad.metrics.leadForm,
            totalLead: ad.metrics.totalLead,
            rphD3: ad.metrics.rphD3.value,
            rphLead: ad.metrics.rphLead.value,
          },
          daysSinceCreation: ad.daysSinceCreation,
        })),
      })),
    })),
  );
}

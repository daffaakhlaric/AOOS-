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
  AdStatus,
  MetaAdsSyncService,
  Verdict,
  type Ad,
  type AdAccount,
  type Campaign,
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
  META_ADS_CONNECTOR_REGISTRY,
  MOBIX_SCRAPER_SERVICE,
  OBJECTIVE_ENGINE,
} from "../../di-tokens.js";
import { AbTestingService } from "../abtesting/abtesting.service.js";
import { ActivityLogger } from "../activity-log/activity-logger.service.js";
import { AgentConfigService } from "../agent-config/agent-config.service.js";
import { AgentLogicService } from "../agent-config/agent-logic.service.js";
import { evaluateLogicRules, type LogicRuleSet } from "../agent-config/logic-interpreter.js";
import { AgentRunsService } from "../agent-runs/agent-runs.service.js";
import { AiJudgeService } from "../ai-judge/ai-judge.service.js";
import { CampaignsService } from "../campaigns/campaigns.service.js";
import { IntelligenceService } from "../intelligence/intelligence.service.js";
import type { ListingResponseDto } from "../listings/dto/listing.dto.js";
import { ListingsService } from "../listings/listings.service.js";
import type { AnalyzeRequestDto } from "../llm/dto/analyze.dto.js";
import { LlmService } from "../llm/llm.service.js";
import { LookalikeService } from "../lookalike/lookalike.service.js";
import {
  AdTenantIndexRepository,
  indexPulledAdAccount,
} from "../meta-ads/infrastructure/ad-tenant-index.repository.js";
import type { MetaAdsConnectorRegistry } from "../meta-ads/infrastructure/meta-ads-connector-registry.js";
import { ModeGuardService } from "../mode-guard/mode-guard.service.js";
import { PendingActionsService } from "../pending-actions/pending-actions.service.js";
import { RecyclingService } from "../recycling/recycling.service.js";
import { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";

import type { CalendarEventResult, StoredCalendarEvent } from "./domain/calendar-event.js";
import { isSupportedCalendarEventType } from "./domain/calendar-event.js";
import {
  HIGH_CPL_MULTIPLIER,
  shouldCreateNewCampaign,
  type CampaignTriggerDecision,
} from "./domain/campaign-trigger.js";
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
 * Drives the "Kalender Aktivitas Samantha & Kai" widget's backend (AAOS-KALENDER-AKTIVITAS).
 *
 * SCOPE (see `docs/PROMPT-AAOS-KALENDER-AKTIVITAS.md`'s COORDINATOR NOTE): only 5 of the spec's
 * 14 proposed event types are implemented — `SCRAPER_RUN`, `SAMANTHA_PULL_DATA`, `SAMANTHA_ANALYZE`,
 * `KAI_REFRESH_CHECK`, `DAILY_DIGEST`. The other 9 (6 campaign-mutating types with no
 * human-approval gate at execution time, plus 3 with zero real backing anywhere in this codebase)
 * have no `case` in `executeEvent`'s switch — a stray row with one of them is marked `FAILED` with
 * an honest "event type tidak didukung" message rather than silently ignored or throwing unhandled.
 *
 * Every handler here is read-only with respect to real Meta campaigns/Kie AI credits: none of them
 * calls `ExecuteVerdict`, creates/activates/pauses a campaign, or generates real creative — that
 * remains entirely out of scope for this pass (coordinator note section 7).
 *
 * MULTI-TENANT (`docs/PROMPT-AAOS-SCHEDULER-MULTITENANT.md`): `checkAndRunDueEvents` loops over
 * every real, non-`SUSPENDED` tenant (`TenantRepository.list()`) and every public CRUD/run-now/skip
 * method takes a real `tenantId` — the same per-request/per-row resolution `SettingsService`
 * already establishes. Honest, documented limitation (that doc's design point 6): creating a new
 * tenant does NOT auto-seed any `calendar_events` rows for it — a brand-new tenant's calendar
 * starts empty and nothing runs automatically until its own manager creates events via the Calendar
 * UI. This is not a regression this phase introduces; `006_calendar_events.sql`'s seed `INSERT`s
 * were always a one-time bootstrap for `dss-motor` only, never a per-new-tenant template.
 */
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(META_ADS_CONNECTOR_REGISTRY)
    private readonly connectorRegistry: MetaAdsConnectorRegistry,
    @Inject(MOBIX_SCRAPER_SERVICE) private readonly scraper: MobixScraperService,
    @Inject(OBJECTIVE_ENGINE) private readonly objectiveEngine: ObjectiveEngine,
    @Inject(LEAD_STORE) private readonly leadStore: LeadStore,
    @Inject(EVENT_PUBLISHER) private readonly publisher: IPublisher,
    private readonly llmService: LlmService,
    private readonly repository: CalendarEventRepository,
    private readonly recyclingService: RecyclingService,
    private readonly abTestingService: AbTestingService,
    private readonly lookalikeService: LookalikeService,
    private readonly intelligenceService: IntelligenceService,
    private readonly adTenantIndex: AdTenantIndexRepository,
    private readonly tenants: TenantRepository,
    private readonly listingsService: ListingsService,
    private readonly modeGuard: ModeGuardService,
    private readonly activityLogger: ActivityLogger,
    private readonly campaignsService: CampaignsService,
    /**
     * AAOS-AI-JUDGE-SELF-IMPROVING (Phase J1) — real per-run judging infrastructure. Injected the
     * SAME way `activityLogger` above already is (a small, standalone `AgentRunsModule` this
     * module imports) — `runSamanthaAnalyze` records one real `agent_runs` row per real
     * `SAMANTHA_ANALYZE` run, best-effort (see `AgentRunsService.record`'s own doc).
     */
    private readonly agentRunsService: AgentRunsService,
    /**
     * AAOS-AI-JUDGE-SELF-IMPROVING (Phase J2) — real, LLM-scored judgment of the `agent_runs` row
     * `runSamanthaAnalyze` records, best-effort (see `AiJudgeService.judgeRun`'s own doc). Injected
     * the same way `agentRunsService` above already is.
     */
    private readonly aiJudgeService: AiJudgeService,
    /**
     * AAOS-OPERATING-MODE-APPROVAL-GATE — real human-approval gate for a tenant in `APPROVAL`
     * operating mode. Injected the SAME way `campaignsService` above already is (`PendingActionsModule`
     * imported directly by `SchedulerModule`) — `recordCampaignTriggerDecision` calls
     * `pendingActions.enqueue` instead of `campaignsService.createPropertyCampaign` when this
     * tenant's real `operating_mode` is `APPROVAL`.
     */
    private readonly pendingActions: PendingActionsService,
    /**
     * AAOS Self-Improving (Phase SI-1) — real, DB-backed `pause_cpl_multiplier` config, resolved
     * once per `runPropertyCampaignTriggerCheck` call and threaded into `shouldCreateNewCampaign`'s
     * real, optional 3rd parameter (see that pure function's own doc for why it stays synchronous).
     * Injected the same way `pendingActions` above already is (`AgentConfigModule`, imported
     * directly by `SchedulerModule`).
     */
    private readonly agentConfigService: AgentConfigService,
    /**
     * AAOS Self-Improving (Phase SI-2) — real, DB-backed, OPTIONAL `verdict_classification`
     * `agent_logic` override, resolved once per `runSamanthaAnalyze` call and used ONLY to
     * reclassify the real PAUSE/SCALE digest counts that method already computes from each ad's
     * `verdict` (see `resolveVerdictOverride`'s own doc for the full "why this one, why it's safe"
     * reasoning). Injected the same way `agentConfigService` above already is (same
     * `AgentConfigModule`).
     */
    private readonly agentLogicService: AgentLogicService,
  ) {}

  /**
   * Checked every minute (spec: `@Cron('* * * * *')`) — every `PENDING` event due within the last
   * minute is run, detached, so a slow handler never blocks the next tick. Loops over every real,
   * non-`SUSPENDED` tenant (`TenantRepository.list()`) rather than one static default — see this
   * module's class doc comment / `docs/PROMPT-AAOS-SCHEDULER-MULTITENANT.md`.
   */
  @Cron("* * * * *")
  async checkAndRunDueEvents(): Promise<void> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - DUE_WINDOW_MS);
    const tenants = await this.tenants.list();
    for (const tenant of tenants) {
      if (tenant.status === "SUSPENDED") {
        continue;
      }
      const dueEvents = await this.repository.listDuePending(
        tenant.tenant_id,
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
        case "SAMANTHA_PULL_DATA":
          result = await this.runSamanthaPullData(event.tenantId, correlationId);
          break;
        case "TAMARA_ANALYZE":
        case "SAMANTHA_ANALYZE":
          result = await this.runSamanthaAnalyze(event.tenantId, event.id, correlationId);
          break;
        case "KAI_REFRESH_CHECK":
          result = await this.runKaiRefreshCheck(event.tenantId, correlationId);
          break;
        case "DAILY_DIGEST":
          result = await this.runDailyDigest(event.tenantId, correlationId);
          break;
        case "RECYCLING_RUN":
          result = await this.runRecyclingRun(correlationId);
          break;
        case "AB_TEST_CHECK":
          result = await this.runAbTestCheck();
          break;
        case "LOOKALIKE_SYNC":
          result = await this.runLookalikeSync();
          break;
        case "TAMARA_INTELLIGENCE_REFRESH":
        case "SAMANTHA_INTELLIGENCE_REFRESH":
          result = await this.runSamanthaIntelligenceRefresh();
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
  async runNow(tenantId: string, id: string): Promise<StoredCalendarEvent> {
    const event = await this.findOrThrow(tenantId, id);
    await this.executeEvent(event);
    return this.findOrThrow(tenantId, id);
  }

  /** `POST /api/v1/calendar/:id/skip` — marks skipped and, for a recurring event, schedules the next occurrence. */
  async skip(tenantId: string, id: string): Promise<StoredCalendarEvent> {
    const event = await this.findOrThrow(tenantId, id);
    await this.repository.markSkipped(id);
    if (event.recurrence !== "ONCE") {
      await this.scheduleNext(event);
    }
    return this.findOrThrow(tenantId, id);
  }

  /**
   * Real ownership check (`docs/PROMPT-AAOS-SCHEDULER-MULTITENANT.md` design point 2) — mirrors
   * `SettingsService.requireWaba`'s exact pattern: a row that exists but belongs to a different
   * tenant is reported the SAME as a row that does not exist at all, never leaking "this id exists
   * but belongs to someone else".
   */
  private async findOrThrow(tenantId: string, id: string): Promise<StoredCalendarEvent> {
    const event = await this.repository.findById(id);
    if (event === undefined || event.tenantId !== tenantId) {
      throw new NotFoundError(`No calendar event found with id "${id}"`);
    }
    return event;
  }

  // ---------------------------------------------------------------------------------------------
  // CRUD — `GET/POST/PUT/DELETE /api/v1/calendar*`.
  // ---------------------------------------------------------------------------------------------

  /** `GET /api/v1/calendar?range=this_week` or `?month=YYYY-MM`. */
  async listEvents(
    tenantId: string,
    query: GetCalendarQueryDto,
  ): Promise<readonly StoredCalendarEvent[]> {
    const { from, to } = resolveCalendarRange(query, new Date());
    return this.repository.listByRange(tenantId, from, to);
  }

  /** `POST /api/v1/calendar` — the "Tambah Jadwal" modal's payload, already narrowed by `CreateCalendarEventBodySchema` to one of the 5 supported event types. */
  async createEvent(
    tenantId: string,
    body: CreateCalendarEventBodyDto,
  ): Promise<StoredCalendarEvent> {
    return this.repository.create({
      id: randomUUID(),
      tenantId,
      eventType: body.eventType,
      title: body.title,
      ...(body.description !== undefined ? { description: body.description } : {}),
      scheduledAt: body.scheduledAt,
      recurrence: body.recurrence,
      ...(body.recurrenceDays !== undefined ? { recurrenceDays: body.recurrenceDays } : {}),
      ...(body.recurrenceTime !== undefined ? { recurrenceTime: body.recurrenceTime } : {}),
      ...(body.recurrenceIntervalHours !== undefined
        ? { recurrenceIntervalHours: body.recurrenceIntervalHours }
        : {}),
      ...(body.metadata !== undefined ? { metadata: body.metadata } : {}),
      ...(body.targetId !== undefined ? { targetId: body.targetId } : {}),
      ...(body.targetName !== undefined ? { targetName: body.targetName } : {}),
      createdBy: "manager",
    });
  }

  /** `PUT /api/v1/calendar/:id` — only the supplied fields are patched. */
  async updateEvent(
    tenantId: string,
    id: string,
    body: UpdateCalendarEventBodyDto,
  ): Promise<StoredCalendarEvent> {
    await this.findOrThrow(tenantId, id);
    await this.repository.update(id, body);
    return this.findOrThrow(tenantId, id);
  }

  /** `DELETE /api/v1/calendar/:id`. */
  async removeEvent(tenantId: string, id: string): Promise<void> {
    await this.findOrThrow(tenantId, id);
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

  /** `SAMANTHA_PULL_DATA` (also matches the legacy `TAMARA_PULL_DATA` event type — see `SUPPORTED_CALENDAR_EVENT_TYPES`' doc comment) — `PullCampaignData` orchestrated by `MetaAdsSyncService` across every configured ad account (coordinator note section 1). */
  private async runSamanthaPullData(
    tenantId: string,
    correlationId: string,
  ): Promise<CalendarEventResult> {
    const adAccounts = await this.pullAdAccounts(tenantId, correlationId);
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
   * `SAMANTHA_ANALYZE` (also matches the legacy `TAMARA_ANALYZE` event type — see
   * `SUPPORTED_CALENDAR_EVENT_TYPES`' doc comment) — new orchestration glue (coordinator note
   * section 6): fetches the tenant's active campaigns itself, calls the real `LlmService.analyze`,
   * and always ALSO aggregates a rule-based PAUSE/SCALE count directly from each ad's
   * already-computed `verdict` (set by `@aos/meta-ads-connector`'s own `evaluateVerdict` during the
   * pull above) — this is the "rule-based fallback path" the coordinator note refers to, and it is
   * computed unconditionally (not only when the LLM is unavailable) so the digest-style summary is
   * always a real, deterministic count.
   */
  private async runSamanthaAnalyze(
    tenantId: string,
    eventId: string,
    correlationId: string,
  ): Promise<CalendarEventResult> {
    const adAccounts = await this.pullAdAccounts(tenantId, correlationId);
    const allAds = adAccounts.flatMap((account) => flattenAds(account));
    const campaigns = adAccounts.reduce((sum, account) => sum + account.campaigns.length, 0);

    // AAOS Self-Improving (Phase SI-2) — real, OPTIONAL `agent_logic` override of the real
    // PAUSE/SCALE digest classification below (see `resolveVerdictOverride`'s own doc for the full
    // "why this one, why it's safe" reasoning). Resolved once per real tenant pull and passed in
    // explicitly, the same "resolve once, pass in explicitly" discipline Phase SI-1's own
    // `cplMultiplier` resolution (`runPropertyCampaignTriggerCheck`) already establishes.
    // `undefined` (no row, or a malformed row — `AgentLogicService.get` never throws) means every
    // ad keeps its real, unmodified `verdict` — zero behavior change until a real ruleset exists.
    const verdictLogicRules = await this.agentLogicService.get(
      tenantId,
      "SAMANTHA",
      "verdict_classification",
    );
    const classifiedVerdicts = allAds.map((ad) => resolveVerdictOverride(ad, verdictLogicRules));
    const pause = classifiedVerdicts.filter((verdict) => verdict === Verdict.PAUSE).length;
    const scale = classifiedVerdicts.filter((verdict) => verdict === Verdict.SCALE).length;

    const analyzePayload: AnalyzeRequestDto = { campaigns: toAnalyzeCampaigns(adAccounts) };
    const analysis =
      analyzePayload.campaigns.length > 0
        ? await this.llmService.analyze(tenantId, analyzePayload)
        : undefined;

    // AAOS-AI-JUDGE-SELF-IMPROVING (Phase J1) — real per-run judging pointer, recorded right after
    // the real `analyze` call above completes (success OR `available: false` — both are real,
    // judgeable outcomes, so this is unconditional, not gated on `analysis !== undefined`).
    // `runRef` is this real `calendar_events.id` (Finding 3 of the design doc: Samantha's real
    // output otherwise only lives inside `calendar_events.result`'s generic JSONB blob — this is
    // the one real, structured pointer a later judge prompt can key off). `context` is a small,
    // judge-prompt-sized summary — campaign/pause/scale counts and whether the LLM was actually
    // available — never the full raw `analysis` response. Best-effort: `AgentRunsService.record`
    // itself never throws, so this can never abort the real Samantha analyze run it describes.
    const agentRunId = await this.agentRunsService.record(tenantId, "SAMANTHA", eventId, {
      campaigns,
      totalAds: allAds.length,
      pause,
      scale,
      aiAvailable: analysis?.available ?? false,
    });
    // AAOS-AI-JUDGE-SELF-IMPROVING (Phase J2) — detached, fire-and-forget, the SAME real
    // `.catch()`-without-await pattern `checkAndRunDueEvents` already uses for `executeEvent` below
    // in this very class. `runSamanthaAnalyze` is on the real, cron-triggered `SAMANTHA_ANALYZE`
    // path — awaiting a real LLM judge call here would delay `markDone`/`markFailed` on the
    // underlying `calendar_events` row (and every downstream step this method still runs, e.g. the
    // PROPERTY campaign-trigger check below) for zero benefit to any real caller.
    if (agentRunId !== undefined) {
      this.aiJudgeService.judgeRun(tenantId, agentRunId).catch((caught: unknown) => {
        this.logger.error(
          `SchedulerService.runSamanthaAnalyze: judgeRun(${agentRunId}) rejected: ${String(caught)}`,
        );
      });
    }

    // AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase C point 4 — PROPERTY-only campaign-creation trigger
    // check, gated by ModeGuardService and logged by ActivityLogger. No-ops (checked: 0) for
    // AUTOMOTIVE tenants (see `runPropertyCampaignTriggerCheck`'s own doc).
    const propertyCampaignTriggers = await this.runPropertyCampaignTriggerCheck(
      tenantId,
      correlationId,
      adAccounts,
    );

    return {
      summary: `${String(campaigns)} kamp · ${String(pause)} PAUSE · ${String(scale)} SCALE`,
      campaigns,
      totalAds: allAds.length,
      pause,
      scale,
      aiAvailable: analysis?.available ?? false,
      propertyCampaignTriggersChecked: propertyCampaignTriggers.checked,
      propertyCampaignTriggersFired: propertyCampaignTriggers.triggered,
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
  private async runKaiRefreshCheck(
    tenantId: string,
    correlationId: string,
  ): Promise<CalendarEventResult> {
    const adAccounts = await this.pullAdAccounts(tenantId, correlationId);
    const pipeline = new OptimizationPipeline();
    const verdictEngine = new VerdictDecisionEngine();
    const agentConfig: MetaAdsAgentConfig = {
      ...DEFAULT_META_ADS_AGENT_CONFIG,
      tenantId,
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

    // AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase C point 4 — same PROPERTY-only campaign-creation
    // trigger check as `runSamanthaAnalyze` (see that method's comment / `runPropertyCampaignTriggerCheck`'s
    // own doc for why both handlers run it — the design doc names both as the real wiring point).
    const propertyCampaignTriggers = await this.runPropertyCampaignTriggerCheck(
      tenantId,
      correlationId,
      adAccounts,
    );

    return {
      summary:
        refreshNeeded > 0
          ? `${String(refreshNeeded)} iklan jenuh → brief ke Kai`
          : "Tidak ada iklan jenuh",
      refreshNeeded,
      ads: refreshedAdNames,
      propertyCampaignTriggersChecked: propertyCampaignTriggers.checked,
      propertyCampaignTriggersFired: propertyCampaignTriggers.triggered,
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
   * Does NOT touch `apps/aaos-dashboard`'s existing client-side `<SamanthaDigest />` — a separate,
   * unrelated component (coordinator note section 2).
   */
  private async runDailyDigest(
    tenantId: string,
    correlationId: string,
  ): Promise<CalendarEventResult> {
    const objectives = this.objectiveEngine.registry.listByTenant(tenantId);
    const objective = [...objectives].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )[0];
    if (objective === undefined) {
      throw new Error(
        `Belum ada Objective aktif untuk tenant "${tenantId}" — Daily Digest butuh Objective bulan berjalan.`,
      );
    }

    const adAccounts = await this.pullAdAccounts(tenantId, correlationId);
    const adAccount = adAccounts[0];
    if (adAccount === undefined) {
      throw new Error("Tidak ada AdAccount yang berhasil ditarik untuk Daily Digest.");
    }

    const hotLeadsCount = await this.countHotLeads(tenantId);

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

    const planResult = ExecutionPlanBuilder.build(tenantId, [], new Date());
    if (!planResult.ok) {
      throw new Error(planResult.error.message);
    }

    const digestService = new DigestService(new MetaAdsAgentEvents(this.publisher));
    const digestResult = await digestService.generate(
      {
        tenantId,
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

    // AAOS-ABTESTING-LOOKALIKE coordinator note section 6: extend the digest's own real text with
    // recently-completed A/B tests + the current Lookalike sync milestone — real data pulled
    // fresh each run from `AbTestingService`/`LookalikeService`, never a new "log to digest"
    // cross-handler write path (there is no persisted digest-log table anywhere — see that note).
    const abTestSection = await this.buildAbTestDigestSection();
    const lookalikeSection = await this.buildLookalikeDigestSection();
    // AAOS-SAMANTHA-INTELLIGENCE-LAYER Phase 4 coordinator note section 7: extend the digest's own
    // real text with the latest real `intelligence_signals` row's key points — real data pulled
    // fresh each run from `IntelligenceService`, same "no new parallel digest-writing path"
    // discipline as the A/B test/Lookalike sections above.
    const intelligenceSection = await this.buildIntelligenceDigestSection();
    const extendedText = [digest.text, abTestSection, lookalikeSection, intelligenceSection]
      .filter((section) => section !== undefined)
      .join("\n\n");

    return {
      summary: `Hot leads ${String(digest.currentHotLeads)}/${String(digest.targetHotLeads)} (${String(digest.progressPercentage)}%)`,
      currentHotLeads: digest.currentHotLeads,
      targetHotLeads: digest.targetHotLeads,
      progressPercentage: digest.progressPercentage,
      budgetSpentPercentage: digest.budgetSpentPercentage,
      text: extendedText,
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

  /**
   * `AB_TEST_CHECK` (AAOS-ABTESTING-LOOKALIKE, coordinator note section 5) — delegates every real
   * decision (launching a DRAFT test whose creatives finished, monitoring RUNNING tests, declaring
   * a winner) to `AbTestingService.runAbTestCheck`, which returns an honest summary — never a
   * fabricated count. Real 6-hour cadence via the new `"INTERVAL_HOURS"` recurrence, checked by
   * this SAME due-window cron rather than a second, parallel `@Cron`.
   */
  private async runAbTestCheck(): Promise<CalendarEventResult> {
    // TENANT-SCOPING FIX (Phase T2): this is a background cron handler with no per-request
    // tenant context (no `@TenantId()` to read here) — explicitly passes the single,
    // process-wide `AAOS_TENANT_ID`, preserving today's exact single-tenant background behavior.
    return this.abTestingService.runAbTestCheck(this.config.AAOS_TENANT_ID);
  }

  /**
   * `LOOKALIKE_SYNC` (AAOS-ABTESTING-LOOKALIKE Part 2, coordinator note section 5) — delegates
   * every real decision (which hot leads are unsynced, uploading their hashed phone numbers,
   * marking them synced) to `LookalikeService.runLookalikeSync`, which returns an honest summary —
   * never a fabricated count. Real daily 02:00 cadence via the pre-existing `"DAILY"` recurrence,
   * checked by this SAME due-window cron rather than a second, parallel `@Cron`.
   */
  private async runLookalikeSync(): Promise<CalendarEventResult> {
    // TENANT-SCOPING FIX (Phase T2): this is a background cron handler with no per-request
    // tenant context (no `@TenantId()` to read here) — explicitly passes the single,
    // process-wide `AAOS_TENANT_ID`, preserving today's exact single-tenant background behavior.
    return this.lookalikeService.runLookalikeSync(this.config.AAOS_TENANT_ID);
  }

  /**
   * `SAMANTHA_INTELLIGENCE_REFRESH` (also matches the legacy `TAMARA_INTELLIGENCE_REFRESH` event
   * type — see `SUPPORTED_CALENDAR_EVENT_TYPES`' doc comment; AAOS-SAMANTHA-INTELLIGENCE-LAYER
   * Phase 4, coordinator note section 7) — delegates every real decision (which signals to
   * aggregate, how to synthesize them) to `IntelligenceService.refresh()`, which returns an
   * honest, real, persisted result — never a fabricated count. Real daily 06:00 cadence via the
   * pre-existing `"DAILY"` recurrence, checked by this SAME due-window cron rather than a second,
   * parallel `@Cron` (same choice as `LOOKALIKE_SYNC`).
   */
  private async runSamanthaIntelligenceRefresh(): Promise<CalendarEventResult> {
    const signals = await this.intelligenceService.refresh();
    const strategySummary = signals.campaignStrategy?.available
      ? signals.campaignStrategy.summary
      : "AI campaign strategy tidak tersedia";
    return {
      summary: strategySummary,
      generatedAt: signals.generatedAt,
    };
  }

  /**
   * Daily Digest extension (AAOS-ABTESTING-LOOKALIKE coordinator note section 6) — real
   * `ab_tests` rows whose `completedAt` falls within the last 24 hours, read via
   * `AbTestingService.listTests`. Returns `undefined` (no section) when none completed —
   * `runDailyDigest` filters that out rather than appending an empty line.
   */
  private async buildAbTestDigestSection(): Promise<string | undefined> {
    const completed = await this.abTestingService.listTests(this.config.AAOS_TENANT_ID, "COMPLETE");
    const windowStart = Date.now() - 24 * 60 * 60 * 1000;
    const recentlyCompleted = completed.filter(
      (test) =>
        test.completedAt !== undefined && new Date(test.completedAt).getTime() >= windowStart,
    );
    if (recentlyCompleted.length === 0) {
      return undefined;
    }
    const lines = recentlyCompleted.map((test) => {
      const improvement =
        test.improvementPct !== undefined ? ` (${String(test.improvementPct)}% lebih efisien)` : "";
      return `  ${test.name} selesai${improvement}.`;
    });
    return ["🔬 A/B Testing:", ...lines].join("\n");
  }

  /**
   * Daily Digest extension (AAOS-ABTESTING-LOOKALIKE coordinator note section 6) — the current
   * real hot-leads-synced-to-Meta count/milestone, read via `LookalikeService.getStatus`.
   */
  private async buildLookalikeDigestSection(): Promise<string | undefined> {
    const status = await this.lookalikeService.getStatus(this.config.AAOS_TENANT_ID);
    if (status.totalHotLeads === 0) {
      return undefined;
    }
    const line = status.lookalikeEligible
      ? `👥 Lookalike: ${String(status.totalHotLeads)}/${String(status.minRequiredForLookalike)} hot leads terkumpul — Lookalike aktif.`
      : `👥 Lookalike: ${String(status.totalHotLeads)}/${String(status.minRequiredForLookalike)} hot leads terkumpul (${String(Math.max(0, status.minRequiredForLookalike - status.totalHotLeads))} lagi untuk aktif Lookalike). Terus jalankan Clara!`;
    return line;
  }

  /**
   * Daily Digest extension (AAOS-SAMANTHA-INTELLIGENCE-LAYER Phase 4, coordinator note section 7)
   * — the latest real `intelligence_signals` row's real campaign-strategy summary, read via
   * `IntelligenceService.getLatest()`. Returns `undefined` (no section) when no Samantha
   * Intelligence run has ever completed for this tenant, rather than appending an empty line.
   */
  private async buildIntelligenceDigestSection(): Promise<string | undefined> {
    const latest = await this.intelligenceService.getLatest();
    if (latest === undefined) {
      return undefined;
    }
    const strategyLine = latest.campaignStrategy?.available
      ? `  Rekomendasi Samantha: ${latest.campaignStrategy.summary}`
      : "  Rekomendasi Samantha: AI campaign strategy tidak tersedia saat ini.";
    return ["🧠 Samantha Intelligence:", strategyLine].join("\n");
  }

  /** Sum of real `HOT`-status leads across every branch (`@aos/lead-store`'s `GetHotLeads`, per branch — there is no tenant-wide aggregate use case). A branch whose lookup fails contributes 0 and is logged, never aborts the whole digest. */
  private async countHotLeads(tenantId: string): Promise<number> {
    let total = 0;
    for (const branchId of ALL_BRANCH_IDS) {
      const result = await this.leadStore.getHotLeads.execute(branchId, tenantId);
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

  /**
   * AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase C point 4 — the real wiring point for
   * `shouldCreateNewCampaign` into `runSamanthaAnalyze`/`runKaiRefreshCheck`. PROPERTY-only: reads
   * this tenant's real `vertical` (`TenantRepository.findByTenantId`, already injected for
   * `ModeGuardService`'s own resolution) and no-ops (`{ checked: 0, triggered: 0 }`) for anything
   * else, e.g. `dss-motor` (AUTOMOTIVE) — `AreaPriority`/`Branch`-based targeting there is
   * unchanged, no regression.
   *
   * For every real `AKTIF` listing (`ListingsService.list`), matches it against this same pull's
   * already-fetched `adAccounts` (`campaign.name` containing the listing's title, `AdStatus.ACTIVE`
   * only — there is no explicit `listings.campaign_id` column anywhere in this schema to join on,
   * so this is a documented, honest heuristic, not a fabricated link) to compute real
   * `hasActiveCampaign`/`maxFrequency`/`cplIDR` signals, then a real tenant-wide average CPL across
   * every listing with a computable CPL this same pull (this codebase's own portfolio, not an
   * external/fabricated benchmark) as `benchmarkCplIDR`. `shouldCreateNewCampaign` (pure,
   * `domain/campaign-trigger.ts`) decides per listing; a listing that should trigger has its
   * decision recorded via `recordCampaignTriggerDecision` — never left as a decision with no trace.
   *
   * Best-effort per listing (same "never let a side-check take down the whole handler" discipline
   * `countHotLeads`/`indexPulledAdAccount` already establish in this file): one listing's
   * `recordCampaignTriggerDecision` failure — including a real `CampaignsService
   * .createPropertyCampaign` failure (AAOS EPIC S, Phase S5: `resolvePropertyTargeting`'s real
   * `ValidationError`, a real Meta API error, etc.) — is logged and skipped, never aborts the rest
   * of this check or the calling `runSamanthaAnalyze`/`runKaiRefreshCheck`.
   */
  private async runPropertyCampaignTriggerCheck(
    tenantId: string,
    correlationId: string,
    adAccounts: readonly AdAccount[],
  ): Promise<{ readonly checked: number; readonly triggered: number }> {
    let tenant;
    try {
      tenant = await this.tenants.findByTenantId(tenantId);
    } catch (caught) {
      this.logger.warn(
        `SchedulerService.runPropertyCampaignTriggerCheck: findByTenantId(${tenantId}) failed: ${String(caught)}`,
      );
      return { checked: 0, triggered: 0 };
    }
    if (tenant === undefined || tenant.vertical !== "PROPERTY") {
      return { checked: 0, triggered: 0 };
    }

    const { listings } = await this.listingsService.list(tenantId, { status: "AKTIF" });
    const now = new Date();

    // AAOS Self-Improving (Phase SI-1) — real, DB-backed override for `HIGH_CPL_MULTIPLIER`,
    // resolved ONCE for this whole pull (not per listing — the value doesn't vary within a single
    // check) and threaded into `shouldCreateNewCampaign`'s real, optional 3rd parameter. Falls back
    // to the exact same hardcoded `HIGH_CPL_MULTIPLIER` (1.5) when no tenant override row exists —
    // zero behavior change until a real `agent_configs` row is customized (`AgentConfigService.get`'s
    // own doc).
    const cplMultiplier = await this.agentConfigService.get(
      tenantId,
      "SAMANTHA",
      "pause_cpl_multiplier",
      HIGH_CPL_MULTIPLIER,
    );

    const perListing = listings.map((listing) => ({
      listing,
      matched: matchActiveCampaignForListing(listing, adAccounts),
    }));

    const definedCpls = perListing
      .map(({ matched }) => matched.cplIDR)
      .filter((cpl): cpl is number => cpl !== undefined);
    const benchmarkCplIDR =
      definedCpls.length > 0
        ? definedCpls.reduce((sum, value) => sum + value, 0) / definedCpls.length
        : undefined;

    let triggered = 0;
    for (const { listing, matched } of perListing) {
      const decision = shouldCreateNewCampaign(
        {
          listingId: listing.id,
          listingCreatedAt: new Date(listing.createdAt),
          hasActiveCampaign: matched.hasActiveCampaign,
          ...(matched.maxFrequency !== undefined ? { maxFrequency: matched.maxFrequency } : {}),
          ...(matched.cplIDR !== undefined ? { cplIDR: matched.cplIDR } : {}),
          ...(benchmarkCplIDR !== undefined ? { benchmarkCplIDR } : {}),
        },
        now,
        cplMultiplier,
      );
      if (!decision.shouldCreate) {
        continue;
      }
      try {
        await this.recordCampaignTriggerDecision(
          tenantId,
          correlationId,
          listing,
          decision,
          // AAOS-OPERATING-MODE-APPROVAL-GATE — `tenant` was already fetched above (real
          // ownership/vertical check at the top of this method), so this reuses that SAME row
          // rather than a second `findByTenantId` read: `operating_mode` defaults to
          // 'FULL_CONTROL' at the DB column level (`031_operating_mode.sql`), so a `tenant` row
          // from before this migration ran (or a test fixture that doesn't set the field) still
          // resolves to the exact real, unconditional today's behavior — zero regression.
          tenant.operating_mode ?? "FULL_CONTROL",
        );
        triggered += 1;
      } catch (caught) {
        this.logger.warn(
          `SchedulerService.runPropertyCampaignTriggerCheck: recordCampaignTriggerDecision(${listing.id}) failed: ${String(caught)}`,
        );
      }
    }

    return { checked: perListing.length, triggered };
  }

  /**
   * AAOS EPIC S, Phase S5 — the real wiring point Phase C's `buildCampaignTriggerOutput` docstring
   * used to say did NOT exist: a real `shouldCreateNewCampaign` trigger now really calls
   * `CampaignsService.createPropertyCampaign` (S3/S4, already committed), which builds the real
   * HOUSING-aware Meta payload (`resolvePropertyTargeting` + `CreateCampaign.execute` with
   * `specialAdCategories: [HOUSING_SPECIAL_AD_CATEGORY]`) that simply did not exist during Phase C.
   *
   * `dailyBudgetIDR` is deliberately OMITTED from the call below (not a scheduler-chosen default):
   * `CreatePropertyCampaignBodySchema.dailyBudgetIDR` is already optional and, when omitted,
   * `CreateCampaign.execute` itself falls back to `@aos/meta-ads-connector`'s own real
   * `DEFAULT_DAILY_BUDGET_IDR` (100_000) — the SAME default the manual
   * `POST /api/v1/campaigns/property` endpoint gets when a manager submits no budget. Inventing a
   * second, scheduler-only default here would just be a second place this number could drift from
   * the connector's own real constant, for no real benefit.
   *
   * SINGLE GATE, deliberately: `createPropertyCampaign` already runs its own real
   * `ModeGuardService.executeOrSimulate` (DEV never touches real Meta; LIVE really creates a
   * campaign+adset) — this method does NOT wrap the call in a second `executeOrSimulate`, which
   * would be a redundant/confusing double-gate of the exact same real decision.
   *
   * DOUBLE-LOGGING DECISION (documented per the S5 task's own instruction): `createPropertyCampaign`
   * already writes its own real `agent_activities` row (`actionType: "CREATE_PROPERTY_CAMPAIGN"`,
   * real `mode`/`status`/output). This method KEEPS a separate, real
   * `actionType: "CAMPAIGN_TRIGGER_RECOMMENDATION"` row rather than consolidating to just the one —
   * NOT true duplication, because the two rows record two different real facts:
   *   1. THIS row: `shouldCreateNewCampaign` (domain/campaign-trigger.ts) decided a trigger should
   *      fire, and WHY (`decision.reasons`) — data `createPropertyCampaign` has no way to know,
   *      since it is also called directly by the manual endpoint with no decision/reasons at all.
   *   2. `createPropertyCampaign`'s own row: what the real campaign-creation attempt itself did
   *      (mode, real ids or DEV preview, matched/unresolved cities).
   * Losing #1 by consolidating would erase the only real audit trail of "the scheduler decided to
   * do this and why" from `agent_activities` — an operator reviewing the activity feed could no
   * longer tell an automated trigger apart from a manager's own manual click. `mode` here is
   * resolved via `ModeGuardService.resolveMode` for TAGGING this row only (same
   * tag-vs-gate split `CampaignsService.createCampaign` itself already uses in one method), never
   * for branching — the actual DEV/LIVE branch is decided exactly once, inside
   * `createPropertyCampaign`.
   *
   * Real error handling: `createPropertyCampaign` can genuinely throw (`resolvePropertyTargeting`'s
   * real `ValidationError` when every city fails to resolve, a real Meta API error, etc.) — this
   * method lets that error fail its OWN activity row (`activityLogger.fail`) and then re-throws, so
   * the caller (`runPropertyCampaignTriggerCheck`) can catch it and skip just this one listing,
   * never aborting the rest of the check (see that method's own doc).
   *
   * AAOS-OPERATING-MODE-APPROVAL-GATE — the real gate insertion point. `operatingMode === 'APPROVAL'`:
   * writes a real `pending_agent_actions` row via `PendingActionsService.enqueue` INSTEAD OF calling
   * `campaignsService.createPropertyCampaign` — no campaign is created yet, no real Meta call of any
   * kind happens. The `CAMPAIGN_TRIGGER_RECOMMENDATION` activity row is still started (same real
   * "the scheduler decided a trigger should fire, and why" audit trail as `FULL_CONTROL`) but
   * finishes via `activityLogger.escalate` (`NEEDS_HUMAN` — the SAME real, already-established
   * terminal status `CreativePackagesService`'s manual-shoot escalation uses for "informational,
   * doesn't gate anything itself" — see that class's own doc) rather than `complete`, since neither
   * `SUCCESS` nor `SIMULATED` honestly describes "nothing was executed, a human must decide".
   * `operatingMode === 'FULL_CONTROL'` (including every value other than the literal `'APPROVAL'`,
   * e.g. a tenant row from before this migration ran): completely unchanged real behavior — calls
   * `createPropertyCampaign` directly, exactly as before this gate existed.
   *
   * SINGLE GATE, deliberately (same discipline this method's own docstring already establishes for
   * `createPropertyCampaign`'s internal DEV/LIVE gate): `operatingMode` is resolved exactly once, by
   * the caller (`runPropertyCampaignTriggerCheck`, from the SAME `tenant` row it already fetched),
   * and branched on exactly once, here — never a second, redundant read/branch.
   */
  private async recordCampaignTriggerDecision(
    tenantId: string,
    correlationId: string,
    listing: ListingResponseDto,
    decision: CampaignTriggerDecision,
    operatingMode: string,
  ): Promise<void> {
    const mode = await this.modeGuard.resolveMode(tenantId);
    const activityId = await this.activityLogger.start({
      tenantId,
      agent: "SAMANTHA",
      actionType: "CAMPAIGN_TRIGGER_RECOMMENDATION",
      mode,
      loopId: correlationId,
      input: { listingId: listing.id, listingTitle: listing.title, reasons: decision.reasons },
    });

    if (operatingMode === "APPROVAL") {
      try {
        const pendingActionId = await this.pendingActions.enqueue({
          tenantId,
          agent: "SAMANTHA",
          actionType: "CREATE_PROPERTY_CAMPAIGN",
          payload: { listingId: listing.id },
        });
        await this.activityLogger.escalate(activityId, {
          output: {
            status: "PENDING_APPROVAL",
            pendingActionId,
            listingId: listing.id,
            reasons: decision.reasons,
          },
        });
      } catch (error) {
        await this.activityLogger.fail(activityId, error);
        throw error;
      }
      return;
    }

    try {
      const result = await this.campaignsService.createPropertyCampaign(
        tenantId,
        { listingId: listing.id },
        correlationId,
      );
      await this.activityLogger.complete(activityId, {
        status: result.simulated ? "SIMULATED" : "SUCCESS",
        ...(result.simulated ? { devPreview: result } : { output: result }),
      });
    } catch (error) {
      await this.activityLogger.fail(activityId, error);
      throw error;
    }
  }

  /**
   * Pulls every configured ad account's real campaign hierarchy (`MetaAdsSyncService.syncAccounts`
   * — one `PullCampaignData` call per account, independent failures). Throws only when EVERY
   * account failed. AAOS-MULTI-TENANT-PHASE1B (Phase 3): resolves this tenant's own
   * `MetaAdsConnector` per call (was a constructor-time `this.metaAdsSyncService = new
   * MetaAdsSyncService(this.connector.pullCampaignData)` before this phase — moved here since
   * `MetaAdsConnectorRegistry.resolve` is async).
   */
  private async pullAdAccounts(
    tenantId: string,
    correlationId: string,
  ): Promise<readonly AdAccount[]> {
    const connectorResult = await this.connectorRegistry.resolve(tenantId);
    if (!connectorResult.ok) {
      throw connectorResult.error;
    }
    const connector = connectorResult.value;
    const metaAdsSyncService = new MetaAdsSyncService(connector.pullCampaignData);
    const inputs = connector.adAccountIds.map((rawId) => {
      const idResult = AdAccountId.create(rawId);
      if (!idResult.ok) {
        throw idResult.error;
      }
      return {
        adAccountId: idResult.value,
        datePreset: DEFAULT_DATE_PRESET,
        accessToken: connector.accessToken,
        tenantId,
        correlationId,
      } as const;
    });

    const results = await metaAdsSyncService.syncAccounts(inputs);
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
    // AAOS-MULTI-TENANT-PHASE1C — best-effort, never-throwing index of every successfully-pulled
    // ad's real Meta id -> tenant, so a later Meta lead webhook can resolve this tenant honestly.
    for (const adAccount of adAccounts) {
      await indexPulledAdAccount(this.adTenantIndex, tenantId, adAccount);
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
      ...(event.recurrenceIntervalHours !== undefined
        ? { recurrenceIntervalHours: event.recurrenceIntervalHours }
        : {}),
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
    case "INTERVAL_HOURS":
      return addHours(previous, event.recurrenceIntervalHours ?? DEFAULT_INTERVAL_HOURS);
    case "ONCE":
    default:
      return undefined;
  }
}

/** `INTERVAL_HOURS`'s fallback step when a row somehow carries no `recurrenceIntervalHours` (should not happen — the API boundary requires it, per `CreateCalendarEventBodySchema`'s refine) — matches `AB_TEST_CHECK`'s own real 6-hour cadence rather than an arbitrary number. */
const DEFAULT_INTERVAL_HOURS = 6;

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000);
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

/** The exact 4 real numeric fields `resolveVerdictOverride` allowlists — mirrors `VerdictEngineInput`'s own real vocabulary (`packages/meta-ads-connector`'s `evaluateVerdict`) minus `objective` (categorical, not representable by this numeric-only rule model — see `resolveVerdictOverride`'s own doc). */
const VERDICT_LOGIC_FIELDS = ["rphChatIDR", "conversations", "spendAmount", "frequency"] as const;

/**
 * AAOS Self-Improving (Phase SI-2) — real, OPTIONAL, declarative reclassification of ONE ad's
 * already-computed `verdict` (`@aos/meta-ads-connector`'s own real `evaluateVerdict`), used ONLY by
 * `runSamanthaAnalyze`'s real PAUSE/SCALE digest classification. Per this class's own doc ("Every
 * handler here is read-only with respect to real Meta campaigns... none of them calls
 * ExecuteVerdict, creates/activates/pauses a campaign"), this can only ever change a DISPLAY
 * count/summary string and an API response field — it can NEVER trigger a real Meta spend change.
 * That is the real, deliberate reason this is the phase's chosen "safe first candidate" (see
 * `036_agent_logic.sql`'s own header doc for the fuller investigation this rewiring target is based
 * on — the 2 genuinely multi-condition engines this codebase actually has,
 * `VerdictEngine.evaluateVerdict`/`VerdictDecisionEngine.decidePause`, both live in separate
 * workspace packages with no single clean, low-risk "one optional parameter" rewiring seam reaching
 * them from `apps/aaos-api`).
 *
 * `rules` is the tenant's real, optional `agent_logic` `"verdict_classification"` ruleset
 * (`AgentLogicService.get`) — `undefined` (no row, or a malformed row) means "keep `ad.verdict`
 * unchanged", the exact same zero-behavior-change default `campaign-trigger.ts`'s own optional
 * `cplMultiplier` parameter establishes (Phase SI-1).
 *
 * Two REAL, deliberate guards keep this override strictly additive, never able to silently
 * fabricate a wrong classification:
 *  - `ad.verdict === Verdict.FIX` is left untouched — a FIX verdict comes from `evaluateVerdict`'s
 *    real, UNCONDITIONAL, highest-priority objective check (a non-numeric field this interpreter's
 *    numeric-only rule model cannot represent), so a FIX ad is never eligible for override.
 *  - `ad.metrics.rphChat.value === null` (spec: `Rph` has no rate when spend/count is 0 — see that
 *    class's own doc) is left untouched — there is no honest numeric Rp/chat to evaluate rules
 *    against.
 * `evaluateLogicRules`'s `result` is only ever trusted when it is a real member of the `Verdict`
 * enum — a rule naming any other string is a real, honest no-op (falls back to `ad.verdict`), never
 * silently accepted as a fabricated new verdict.
 */
function resolveVerdictOverride(ad: Ad, rules: LogicRuleSet | undefined): Verdict {
  if (rules === undefined || ad.verdict === Verdict.FIX) {
    return ad.verdict;
  }
  const rphChatIDR = ad.metrics.rphChat.value;
  if (rphChatIDR === null) {
    return ad.verdict;
  }
  const override = evaluateLogicRules(
    rules,
    {
      rphChatIDR,
      conversations: ad.metrics.conversations,
      spendAmount: ad.metrics.spend.toNumber(),
      frequency: ad.metrics.frequency,
    },
    VERDICT_LOGIC_FIELDS,
  );
  if (override === undefined) {
    return ad.verdict;
  }
  const realVerdictValues: readonly string[] = Object.values(Verdict);
  return realVerdictValues.includes(override) ? (override as Verdict) : ad.verdict;
}

/** One listing's real, active-campaign-matched signals (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase C point 4). See `runPropertyCampaignTriggerCheck`'s doc for the matching heuristic's honest limitation. */
interface MatchedCampaignSignals {
  readonly hasActiveCampaign: boolean;
  readonly maxFrequency?: number;
  readonly cplIDR?: number;
}

/** Pure — matches `listing` against every `AdStatus.ACTIVE` campaign across `adAccounts` whose real `name` contains the listing's real `title` (case-insensitive substring; no `listings.campaign_id` column exists anywhere in this schema to join on instead), and aggregates that campaign's real ad-level `frequency`/spend/lead metrics. */
function matchActiveCampaignForListing(
  listing: ListingResponseDto,
  adAccounts: readonly AdAccount[],
): MatchedCampaignSignals {
  const needle = listing.title.toLowerCase();
  let hasActiveCampaign = false;
  let maxFrequency: number | undefined;
  let totalSpend = 0;
  let totalLeads = 0;

  const isMatch = (campaign: Campaign): boolean =>
    campaign.status === AdStatus.ACTIVE && campaign.name.toLowerCase().includes(needle);

  for (const account of adAccounts) {
    for (const campaign of account.campaigns) {
      if (!isMatch(campaign)) {
        continue;
      }
      hasActiveCampaign = true;
      for (const adSet of campaign.adSets) {
        for (const ad of adSet.ads) {
          maxFrequency =
            maxFrequency === undefined
              ? ad.metrics.frequency
              : Math.max(maxFrequency, ad.metrics.frequency);
          totalSpend += ad.metrics.spend.toNumber();
          totalLeads += ad.metrics.totalLead;
        }
      }
    }
  }

  const cplIDR = totalLeads > 0 ? totalSpend / totalLeads : undefined;
  return {
    hasActiveCampaign,
    ...(maxFrequency !== undefined ? { maxFrequency } : {}),
    ...(cplIDR !== undefined ? { cplIDR } : {}),
  };
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

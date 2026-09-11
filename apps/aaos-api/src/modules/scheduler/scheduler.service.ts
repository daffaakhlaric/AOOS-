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
  scoreCreativeDiversity,
  Verdict,
  type Ad,
  type AdAccount,
  type Campaign,
  type CreativeDiversityScore,
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
import { AuditLogService } from "../audit-log/audit-log.service.js";
import { CampaignsService } from "../campaigns/campaigns.service.js";
import { CreativePackagesService } from "../creative-packages/creative-packages.service.js";
import type { StoredCreativePackage } from "../creative-packages/domain/creative-package.js";
import { toCreativePackageResponseDto } from "../creative-packages/dto/creative-package-response.dto.js";
import { CreativePackageRepository } from "../creative-packages/infrastructure/creative-package.repository.js";
import { IntelligenceService } from "../intelligence/intelligence.service.js";
import type { ListingResponseDto } from "../listings/dto/listing.dto.js";
import { ListingsService } from "../listings/listings.service.js";
import type { AnalyzeRequestDto } from "../llm/dto/analyze.dto.js";
import {
  ALL_PROPERTY_AD_ANGLE_VALUES,
  MAX_DIVERSE_BRIEF_COUNT,
  type DiverseCreativeBriefSetRequestDto,
} from "../llm/dto/diverse-creative-brief-set.dto.js";
import { LlmService } from "../llm/llm.service.js";
import { LookalikeService } from "../lookalike/lookalike.service.js";
import { MarketIntelligenceService } from "../market-intelligence/market-intelligence.service.js";
import {
  AdTenantIndexRepository,
  indexPulledAdAccount,
} from "../meta-ads/infrastructure/ad-tenant-index.repository.js";
import type { MetaAdsConnectorRegistry } from "../meta-ads/infrastructure/meta-ads-connector-registry.js";
import { ModeGuardService, type TenantMode } from "../mode-guard/mode-guard.service.js";
import { PendingActionsService } from "../pending-actions/pending-actions.service.js";
import { isBusinessContextFilled } from "../property-objective/dto/property-objective.dto.js";
import { PropertyObjectiveService } from "../property-objective/property-objective.service.js";
import { buildCplReasoningText } from "../property-objective/reasoning.js";
import { RecyclingService } from "../recycling/recycling.service.js";
import { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";

import { evaluateAndromedaRestructureCandidate } from "./domain/andromeda-restructure.js";
import type { CalendarEventResult, StoredCalendarEvent } from "./domain/calendar-event.js";
import { isSupportedCalendarEventType } from "./domain/calendar-event.js";
import { decideCampaignPublishGuardrail } from "./domain/campaign-publish-guardrail.js";
import {
  HIGH_CPL_MULTIPLIER,
  shouldCreateNewCampaign,
  type CampaignTriggerDecision,
} from "./domain/campaign-trigger.js";
import { decideCreativeBriefGuardrail } from "./domain/creative-brief-guardrail.js";
import { evaluateFatigue } from "./domain/fatigue.js";
import { evaluateNeedCreative } from "./domain/need-creative.js";
import type {
  CreateCalendarEventBodyDto,
  GetCalendarQueryDto,
  UpdateCalendarEventBodyDto,
} from "./dto/calendar-event.dto.js";
import type { DiverseCreativeBriefSetResultDto } from "./dto/diverse-creative-brief-set.dto.js";
import { CalendarEventRepository } from "./infrastructure/calendar-event.repository.js";
import { LoopRunRepository } from "./infrastructure/loop-run.repository.js";

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
    private readonly marketIntelligenceService: MarketIntelligenceService,
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
    /**
     * AAOS LOOP UPGRADE, Sprint 6 Prompt 17 — real `audit_log` writer for the FULL_CONTROL branch
     * of `recordCampaignTriggerDecision` (a real, non-simulated LIVE-mode campaign publish —
     * `CAMPAIGN_PUBLISHED`, `reversible: true`). Injected the same way `pendingActions` above
     * already is (`AuditLogModule`, imported directly by `SchedulerModule`).
     */
    private readonly auditLog: AuditLogService,
    /**
     * AAOS LOOP UPGRADE, Sprint 6 Prompt 15 — real, tenant-set Business Context (AOV/target-CPL/
     * breakeven-CPL), resolved once per `runPropertyCampaignTriggerCheck` call and threaded into
     * `buildCplReasoningText` so the real `CAMPAIGN_TRIGGER_RECOMMENDATION` activity row's
     * `reasoning` text explicitly cites the tenant's own real numbers instead of a generic
     * threshold-only sentence (see that function's own doc). Injected the same way
     * `agentConfigService` above already is.
     */
    private readonly propertyObjectiveService: PropertyObjectiveService,
    /**
     * AAOS LOOP UPGRADE, Sprint 6 Prompt 16 — real per-listing fatigue check
     * (`runPropertyCampaignTriggerCheck`'s own extension), reusing the SAME real
     * `matchActiveCampaignForListing` frequency signal already computed for the CPL-trigger check.
     * Injected directly (not via a small standalone service — this table's own repository already
     * mirrors every other Supabase-backed repository's composition, see `CreativePackagesModule`).
     */
    private readonly creativePackageRepository: CreativePackageRepository,
    /**
     * AAOS LOOP UPGRADE, Sprint 8b (Prompt 19 Step 4) — the real, honest auto-trigger this dispatch
     * adds: `runNeedCreativeCheck`'s auto-approved-DRAFT branch (below) calls
     * `CreativePackagesService.triggerAutoLoopGeneration` immediately after inserting the row,
     * rather than waiting for a second cron tick or a separate queue — the row is already
     * known-fresh in this same request, so this is the most immediate, honest trigger point (see
     * this dispatch's own coordinator note for the "immediate vs. cron" investigation this
     * decision is based on). No circular-import risk: `CreativePackagesModule`'s own import graph
     * (`ListingsModule`/`ModeGuardModule`/`ActivityLogModule`/`AgentRunsModule`/`AiJudgeModule`/
     * `AuditLogModule`) does not import `SchedulerModule` (verified directly).
     */
    private readonly creativePackagesService: CreativePackagesService,
    /**
     * AAOS LOOP UPGRADE, Sprint 8c (Prompt 19 Steps 5-6) — real `loop_runs` writer
     * (`runPropertyCampaignTriggerCheck`'s own end-of-cycle summary insert). Injected directly (the
     * SAME "provide the leaf repository class directly" pattern `creativePackageRepository` above
     * already establishes) rather than via a small standalone module, since this repository has no
     * real dependents outside this class.
     */
    private readonly loopRunRepository: LoopRunRepository,
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
        case "MARKET_INTELLIGENCE_REFRESH":
          result = await this.runMarketIntelligenceRefresh();
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
      // AAOS Self-Improving (Phase SI-4) — real, ADDITIVE capture of the EXACT `AnalyzeRequestDto`
      // body just sent to `LlmService.analyze` above, so `SandboxService.testImprovement` can
      // honestly re-run `analyze` against the SAME real historical data later. Deliberately NEW keys
      // (`analyzeCampaigns`/`analyzeTotals`), never overwriting/renaming the existing `campaigns`
      // key above — that key is a plain COUNT the real SAMANTHA judge prompt already reads as
      // `context.campaigns` (see `SAMANTHA_JUDGE_SYSTEM_PROMPT`'s own doc); reusing it here for a
      // full array would silently corrupt judge scoring. Zero behavior change to the real judge
      // call — an additive field it never reads. REAL, HONEST GAP this phase's own investigation
      // found and fixes: before this change, `agent_runs.context` for SAMANTHA held only summary
      // counts, never the actual `campaigns`/`totals` fed to `analyze` — not enough to honestly
      // re-run it. Every `agent_runs` row written BEFORE this migration/deploy still lacks these 2
      // keys; `SandboxService.testImprovement` detects that and degrades honestly rather than
      // fabricating a re-run for those older rows.
      analyzeCampaigns: analyzePayload.campaigns,
      analyzeTotals: analyzePayload.totals ?? null,
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
    // AAOS LOOP UPGRADE, Sprint 8c — real per-ad verdict count for this cycle's `loop_runs.total_verdicts`
    // (PAUSE + SCALE, the SAME real classification already computed above for the digest summary).
    const propertyCampaignTriggers = await this.runPropertyCampaignTriggerCheck(
      tenantId,
      correlationId,
      adAccounts,
      pause + scale,
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
    // AAOS LOOP UPGRADE, Sprint 8c — this handler's own real per-ad decision count for
    // `loop_runs.total_verdicts`: the number of ads that decided REFRESH this cycle (`refreshNeeded`,
    // an honest, real count distinct from `runSamanthaAnalyze`'s PAUSE+SCALE count — see
    // `runPropertyCampaignTriggerCheck`'s own doc for why no single true "verdict count" exists at
    // this shared call site).
    const propertyCampaignTriggers = await this.runPropertyCampaignTriggerCheck(
      tenantId,
      correlationId,
      adAccounts,
      refreshedAdNames.length,
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
   * `MARKET_INTELLIGENCE_REFRESH` (AAOS LOOP UPGRADE, Sprint 7 Prompt 18) — delegates every real
   * decision (which of the 4 real Market Intelligence sources to aggregate, how to combine them) to
   * `MarketIntelligenceService.refresh()`, which returns an honest, real, persisted result — never
   * a fabricated count. Real weekly cadence via the pre-existing `"WEEKLY"` recurrence, checked by
   * this SAME due-window cron rather than a second, parallel `@Cron` (same choice as
   * `runSamanthaIntelligenceRefresh`/`LOOKALIKE_SYNC`).
   */
  private async runMarketIntelligenceRefresh(): Promise<CalendarEventResult> {
    const signals = await this.marketIntelligenceService.refresh();
    return {
      summary: signals.digestText ?? "Sinyal Pasar diperbarui.",
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
    verdictCount: number,
  ): Promise<{ readonly checked: number; readonly triggered: number }> {
    // AAOS LOOP UPGRADE, Sprint 8c — real Step 6 loop-run boundary: this method is the real,
    // shared per-cycle entry point both `runSamanthaAnalyze`/`runKaiRefreshCheck` already call once
    // per tick, so its own start/end is the real, honest "one loop run" the spec's Step 6 describes.
    const cycleStartedAt = new Date();
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

    // AAOS LOOP UPGRADE, Sprint 6 Prompt 15 — real, tenant-set Business Context, resolved ONCE for
    // this whole pull (same "resolve once, pass in explicitly" discipline `cplMultiplier` above
    // already establishes). `undefined` (no current objective yet, or one with an unfilled business
    // context) means `buildCplReasoningText` falls back to the generic threshold sentence — never a
    // fabricated breakeven number.
    const objective = await this.propertyObjectiveService.getCurrentSafe(tenantId);
    const breakevenCpl =
      objective !== undefined && isBusinessContextFilled(objective)
        ? objective.breakevenCpl
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
        // AAOS LOOP UPGRADE, Sprint 6 Prompt 15 — real business-context-aware reasoning text for a
        // HIGH_CPL trigger, logged onto the SAME `agent_activities` row
        // `recordCampaignTriggerDecision` starts (`ActivityLogger.logReasoning`), so the dashboard's
        // real Activity detail drawer's "Reasoning" tab shows it. Only built when `HIGH_CPL` is
        // actually one of the fired reasons — the other 3 reasons have no CPL number to reason
        // about.
        const activityId = await this.recordCampaignTriggerDecision(
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
        if (
          decision.reasons.includes("HIGH_CPL") &&
          matched.cplIDR !== undefined &&
          benchmarkCplIDR !== undefined
        ) {
          await this.activityLogger.logReasoning(
            activityId,
            buildCplReasoningText({
              cplIDR: matched.cplIDR,
              benchmarkCplIDR,
              cplMultiplier,
              ...(breakevenCpl !== undefined ? { breakevenCpl } : {}),
            }),
          );
        }
        triggered += 1;
      } catch (caught) {
        this.logger.warn(
          `SchedulerService.runPropertyCampaignTriggerCheck: recordCampaignTriggerDecision(${listing.id}) failed: ${String(caught)}`,
        );
      }
    }

    // AAOS LOOP UPGRADE, Sprint 6 Prompt 16 — real per-listing fatigue check, reusing the SAME
    // `matched.maxFrequency` signal already computed above for the CPL-trigger check. Best-effort
    // per listing, same discipline as the trigger loop above.
    await this.runFatigueCheck(tenantId, correlationId, perListing);

    // AAOS LOOP UPGRADE, Sprint 8a — real NEED_CREATIVE detection + guardrailed auto-brief
    // creation (Prompt 19 Steps 2-3), reusing the SAME `perListing` (matched campaign + real
    // per-ad verdicts) this method already computed above. Best-effort per listing.
    const needCreativeResult = await this.runNeedCreativeCheck(tenantId, perListing);

    // Samantha Andromeda-Aware Campaign System, Sprint 1 — real, additive ad-set-fragmentation +
    // creative-diversity detection, reusing the SAME `perListing` this method already computed
    // above (`matched.matchedCampaigns`, the real `Campaign` tree). Best-effort, never
    // auto-executes anything — see `runAndromedaRestructureCheck`'s own doc.
    await this.runAndromedaRestructureCheck(tenantId, perListing);

    // AAOS LOOP UPGRADE, Sprint 8c — real Step 5: Samantha builds/publishes a campaign from a
    // freshly Kai/Kie-AI-generated asset, reusing the SAME `perListing` this method already
    // computed above (`matched.hasActiveCampaign` is the real guardrail input this check needs).
    // Best-effort per listing, same discipline as every other check in this method.
    const campaignPublishResult = await this.runCampaignPublishCheck(
      tenantId,
      correlationId,
      perListing,
      tenant.operating_mode ?? "FULL_CONTROL",
    );

    // AAOS LOOP UPGRADE, Sprint 8c — real Step 6: one `loop_runs` summary row per real cycle.
    // Best-effort (mirrors `AuditLogService.record`'s own "a logging failure must never fail the
    // real action it describes" discipline) — a failure to write this summary row must never abort
    // (or retroactively fail) a loop cycle whose real work (triggers/briefs/assets/campaigns above)
    // already completed.
    const completedAt = new Date();
    try {
      await this.loopRunRepository.insert({
        id: correlationId,
        tenantId,
        startedAt: cycleStartedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - cycleStartedAt.getTime(),
        totalVerdicts: verdictCount,
        totalBriefsAutoGenerated: needCreativeResult.briefsCreated,
        totalAssetsGenerated: campaignPublishResult.assetsConsidered,
        // HONEST, DOCUMENTED PARTIAL COUNT: only Step 5's own real campaign-publish attempts
        // (DEV-simulated or real LIVE) are counted here — the pre-existing HIGH_CPL trigger loop
        // above (`triggered`) also sometimes results in a real `createPropertyCampaign` call, but
        // that loop's own `triggered` counter conflates "a trigger decision was recorded" (which
        // includes the real `APPROVAL`-mode branch, where NO campaign is created yet) with "a
        // campaign was actually published" — reusing it here would overcount. Correctly splitting
        // that counter is out of scope for this dispatch; see this method's own coordinator note.
        totalCampaignsPublished: campaignPublishResult.campaignsPublished,
      });
    } catch (caught) {
      this.logger.warn(
        `SchedulerService.runPropertyCampaignTriggerCheck: loopRunRepository.insert(${correlationId}) failed: ${String(caught)}`,
      );
    }

    return { checked: perListing.length, triggered };
  }

  /**
   * AAOS LOOP UPGRADE, Sprint 8c (Prompt 19 Step 5) — real, guardrailed trigger: Samantha builds/
   * publishes a real Meta campaign using a freshly Kai/Kie-AI-generated asset.
   *
   * HONEST TRIGGER DEFINITION (documented deviation from the spec's literal wording): the spec says
   * "ada asset GENERATED" — this app's real `CreativePackageStatus` enum has no `GENERATED` value; a
   * successfully completed generation lands on `PENDING` ("generated, awaiting review", see
   * `creative-package.ts`'s own status doc). This method therefore treats a `creative_packages` row
   * with `source === 'auto_loop'`, `status === 'PENDING'`, a real `relatedVerdictId` matching this
   * listing, and `campaignPublishStatus === undefined` (not yet considered — see
   * `048_campaign_auto_publish.sql`'s own doc) as the honest analog of "GENERATED". Only the single
   * most-recently-created matching package per listing is considered per cycle (avoids building two
   * campaigns for two assets generated in quick succession for the same listing).
   *
   * HONEST, DOCUMENTED SCOPE LIMIT: `decideCampaignPublishGuardrail` always routes a listing with
   * `matched.hasActiveCampaign === true` to `PENDING_REVIEW` — no real "increase an EXISTING
   * campaign's budget" Meta API mutation exists anywhere in this codebase (verified directly against
   * `@aos/meta-ads-connector` — only `CreateCampaign` exists), so this method never guesses at one.
   * Every real call this method makes is the SAME, already-proven, already-audited
   * `CampaignsService.createPropertyCampaign` (a brand-new campaign, DEV-safe/LIVE-real exactly like
   * `recordCampaignTriggerDecision`'s own FULL_CONTROL branch) — never a second, parallel
   * campaign-mutation code path.
   *
   * `operatingMode === 'APPROVAL'` (the tenant-level gate, same real precedent
   * `recordCampaignTriggerDecision` already establishes) forces `PENDING_REVIEW` regardless of the
   * guardrail's own decision — a SECOND, independent real reason a human must approve, on top of
   * `auto_publish_campaign`/`max_budget_increase_pct`.
   *
   * Best-effort per listing (same "never let a side-check take down the whole handler" discipline
   * every other check in this class already establishes): a failure marks the package `SKIPPED` (best
   * effort itself — a failure to even mark it is logged and moved past) rather than left forever
   * re-triggerable, so a human reviewing the Creative Hub can still see and act on it manually.
   */
  private async runCampaignPublishCheck(
    tenantId: string,
    correlationId: string,
    perListing: readonly {
      readonly listing: ListingResponseDto;
      readonly matched: MatchedCampaignSignals;
    }[],
    operatingMode: string,
  ): Promise<{ readonly assetsConsidered: number; readonly campaignsPublished: number }> {
    let mode: TenantMode;
    let autoPublishCampaign: boolean;
    let maxBudgetIncreasePct: number;
    try {
      mode = await this.modeGuard.resolveMode(tenantId);
      ({ autoPublishCampaign, maxBudgetIncreasePct } =
        await this.propertyObjectiveService.getAutoPublishSettingsSafe(tenantId));
    } catch (caught) {
      this.logger.warn(
        `SchedulerService.runCampaignPublishCheck: resolving mode/guardrail settings for ${tenantId} failed: ${String(caught)}`,
      );
      return { assetsConsidered: 0, campaignsPublished: 0 };
    }

    let packages: readonly StoredCreativePackage[];
    try {
      packages = await this.creativePackageRepository.list(tenantId, {
        status: "PENDING",
        limit: 200,
      });
    } catch (caught) {
      this.logger.warn(
        `SchedulerService.runCampaignPublishCheck: list(${tenantId}) failed: ${String(caught)}`,
      );
      return { assetsConsidered: 0, campaignsPublished: 0 };
    }

    let assetsConsidered = 0;
    let campaignsPublished = 0;

    for (const { listing, matched } of perListing) {
      const candidates = packages
        .filter(
          (pkg) =>
            pkg.source === "auto_loop" &&
            pkg.relatedVerdictId === listing.id &&
            pkg.campaignPublishStatus === undefined,
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const pkg = candidates[0];
      if (pkg === undefined) {
        continue;
      }
      assetsConsidered += 1;

      const activityId = await this.activityLogger.start({
        tenantId,
        agent: "SAMANTHA",
        actionType: "CAMPAIGN_PUBLISH_FROM_ASSET",
        mode,
        loopId: correlationId,
        input: {
          listingId: listing.id,
          listingTitle: listing.title,
          creativePackageId: pkg.id,
          hasActiveCampaign: matched.hasActiveCampaign,
        },
      });

      try {
        const guardrail =
          operatingMode === "APPROVAL"
            ? ({
                allowed: false,
                status: "PENDING_REVIEW",
                reason:
                  "Tenant ini di operating_mode APPROVAL — publish campaign butuh approve manual, terlepas dari toggle auto-publish.",
              } as const)
            : decideCampaignPublishGuardrail({
                mode,
                autoPublishEnabled: autoPublishCampaign,
                hasActiveCampaign: matched.hasActiveCampaign,
                maxBudgetIncreasePct,
              });

        if (!guardrail.allowed) {
          const pendingActionId = await this.pendingActions.enqueue({
            tenantId,
            agent: "SAMANTHA",
            actionType: "PUBLISH_CAMPAIGN_FROM_ASSET",
            payload: { listingId: listing.id, creativePackageId: pkg.id },
          });
          await this.creativePackageRepository.markCampaignPublishStatus(pkg.id, "PENDING_REVIEW");
          await this.activityLogger.escalate(activityId, {
            output: {
              status: "PENDING_APPROVAL",
              pendingActionId,
              listingId: listing.id,
              creativePackageId: pkg.id,
              reason: guardrail.reason,
            },
          });
          continue;
        }

        // AAOS-SAMANTHA-LLM-AD-COPY — `pkg.id` is threaded through so `createPropertyCampaign` can
        // publish up to 3 real Meta Ads (one per `pkg.copyVariants` entry) in the same AdSet it
        // creates, reusing this SAME matched package rather than re-deriving the match a second way.
        const result = await this.campaignsService.createPropertyCampaign(
          tenantId,
          { listingId: listing.id },
          correlationId,
          pkg.id,
        );
        await this.creativePackageRepository.markCampaignPublishStatus(pkg.id, "PUBLISHED");
        await this.activityLogger.complete(activityId, {
          status: result.simulated ? "SIMULATED" : "SUCCESS",
          ...(result.simulated ? { devPreview: result } : { output: result }),
        });

        // Same real `CAMPAIGN_PUBLISHED` audit_log writer `recordCampaignTriggerDecision` already
        // uses — reused here, not forked (see this method's own doc).
        if (!result.simulated && result.campaignId !== undefined) {
          await this.auditLog.record({
            tenantId,
            agent: "SAMANTHA",
            actionType: "CAMPAIGN_PUBLISHED",
            beforeState: null,
            afterState: result,
            decidedBy: "ai_auto",
            mode,
            relatedVerdictId: activityId,
            relatedBriefId: pkg.id,
            reversible: true,
          });
          campaignsPublished += 1;
        } else if (result.simulated) {
          // DEV-mode draft preview — a real, honest "attempted" publish, counted the same way
          // `recordCampaignTriggerDecision`'s own `SIMULATED` branch is (no real Meta call, no
          // audit_log row — nothing real happened yet to audit).
          campaignsPublished += 1;
        }
      } catch (caught) {
        this.logger.warn(
          `SchedulerService.runCampaignPublishCheck: publish failed for listing ${listing.id}, package ${pkg.id}: ${String(caught)}`,
        );
        await this.activityLogger.fail(activityId, caught);
        try {
          await this.creativePackageRepository.markCampaignPublishStatus(pkg.id, "SKIPPED");
        } catch (markCaught) {
          this.logger.warn(
            `SchedulerService.runCampaignPublishCheck: markCampaignPublishStatus(${pkg.id}, SKIPPED) failed: ${String(markCaught)}`,
          );
        }
      }
    }

    return { assetsConsidered, campaignsPublished };
  }

  /**
   * AAOS LOOP UPGRADE, Sprint 6 Prompt 16 — real fatigue detection, run once per
   * `runPropertyCampaignTriggerCheck` call (i.e. once per real loop cycle that pulls PROPERTY
   * campaign data — the spec's own "jalan tiap loop run" requirement). See `scheduler/domain/
   * fatigue.ts`'s own header doc for the full, honest data-availability finding this method's shape
   * reflects: `ctrTrend` is always `undefined` here (no real 7-day-vs-previous-7-day time series
   * exists anywhere in this app today), so `evaluateFatigue` can only ever honestly return `NORMAL`
   * or `WARNING` from this real call site — never a fabricated `FATIGUED`.
   *
   * Updates EVERY `creative_packages` row whose real `listing_id` matches this listing (a listing
   * can honestly have more than one creative package) — `creative_packages` is the real,
   * PROPERTY-reachable table this feature attaches to (see `044_creative_packages_fatigue.sql`'s own
   * doc for why, not the spec's literal `creative_assets`). Only writes an activity log row when the
   * status actually CHANGES (never a duplicate "still WARNING" row every single loop tick).
   */
  private async runFatigueCheck(
    tenantId: string,
    correlationId: string,
    perListing: readonly {
      readonly listing: ListingResponseDto;
      readonly matched: MatchedCampaignSignals;
    }[],
  ): Promise<void> {
    for (const { listing, matched } of perListing) {
      if (matched.maxFrequency === undefined) {
        continue;
      }
      const evaluation = evaluateFatigue({ frequencyCurrent: matched.maxFrequency });
      let packages: readonly StoredCreativePackage[];
      try {
        packages = await this.creativePackageRepository.list(tenantId, { limit: 200 });
      } catch (caught) {
        this.logger.warn(
          `SchedulerService.runFatigueCheck: list(${tenantId}) failed: ${String(caught)}`,
        );
        return;
      }
      const matchingPackages = packages.filter((pkg) => pkg.listingId === listing.id);
      for (const pkg of matchingPackages) {
        if (pkg.fatigueStatus === evaluation.status) {
          continue;
        }
        try {
          await this.creativePackageRepository.updateFatigueStatus(pkg.id, evaluation.status);
          if (evaluation.status !== "NORMAL") {
            const activityId = await this.activityLogger.start({
              tenantId,
              agent: "KAI",
              actionType: "FATIGUE_DETECTED",
              mode: await this.modeGuard.resolveMode(tenantId),
              loopId: correlationId,
              input: { listingId: listing.id, packageId: pkg.id, packageTitle: pkg.title },
            });
            await this.activityLogger.logReasoning(
              activityId,
              `Fatigue terdeteksi: ${pkg.title} — ${evaluation.reasoning}`,
            );
            await this.activityLogger.complete(activityId, {
              status: "SUCCESS",
              output: { status: evaluation.status },
            });
          }
        } catch (caught) {
          this.logger.warn(
            `SchedulerService.runFatigueCheck: updateFatigueStatus(${pkg.id}) failed: ${String(caught)}`,
          );
        }
      }
    }
  }

  /**
   * AAOS LOOP UPGRADE, Sprint 8a — Prompt 19 Steps 2-3 real wiring. Run once per
   * `runPropertyCampaignTriggerCheck` call, the SAME cadence `runFatigueCheck` already uses (real
   * signals — `matched.verdicts`, `creative_packages` fatigue status — are only ever this fresh at
   * that cadence).
   *
   * For every listing: computes `evaluateNeedCreative`'s real inputs from data already loaded this
   * pull (`matched.verdicts`, and this listing's own `creative_packages` rows — reusing the SAME
   * `packages` list `runFatigueCheck` itself loads, via a second `list()` call here since these are
   * two separate best-effort methods, same "each best-effort method reads its own fresh copy"
   * discipline `runFatigueCheck`/`runPropertyCampaignTriggerCheck` already establish for their own
   * repository reads). When `evaluateNeedCreative` triggers, resolves the real guardrail chain
   * (`decideCreativeBriefGuardrail` — daily cap, DEV/LIVE mode, `auto_approve_creative_brief`
   * toggle) and, when allowed, inserts ONE real `creative_packages` row (`source: 'auto_loop'`),
   * writes a real `audit_log` row (`CREATIVE_BRIEF_CREATED`, `decided_by: 'ai_auto'`), and — only
   * when the guardrail decided `PENDING_REVIEW` — enqueues a real `pending_agent_actions` row
   * (`action_type: 'REVIEW_CREATIVE_BRIEF'`) so it surfaces in the existing, generic Pending
   * Actions review queue (`LearningMonitorClient.tsx`'s own "Pending Actions" section — investigated
   * directly: it already renders ANY `action_type` generically with real Approve/Reject buttons, no
   * UI change needed for a new row to appear there).
   *
   * Best-effort per listing, same "never let a side-check take down the whole handler" discipline
   * `runFatigueCheck`/`recordCampaignTriggerDecision` already establish.
   */
  private async runNeedCreativeCheck(
    tenantId: string,
    perListing: readonly {
      readonly listing: ListingResponseDto;
      readonly matched: MatchedCampaignSignals;
    }[],
  ): Promise<{ readonly briefsCreated: number }> {
    let mode: TenantMode;
    let maxAutoBriefsPerDay: number;
    let autoApproveCreativeBrief: boolean;
    try {
      mode = await this.modeGuard.resolveMode(tenantId);
      ({ maxAutoBriefsPerDay, autoApproveCreativeBrief } =
        await this.propertyObjectiveService.getAutoLoopSettingsSafe(tenantId));
    } catch (caught) {
      this.logger.warn(
        `SchedulerService.runNeedCreativeCheck: resolving mode/guardrail settings for ${tenantId} failed: ${String(caught)}`,
      );
      return { briefsCreated: 0 };
    }

    let packages: readonly StoredCreativePackage[];
    try {
      packages = await this.creativePackageRepository.list(tenantId, { limit: 200 });
    } catch (caught) {
      this.logger.warn(
        `SchedulerService.runNeedCreativeCheck: list(${tenantId}) failed: ${String(caught)}`,
      );
      return { briefsCreated: 0 };
    }

    const startOfTodayUtc = new Date();
    startOfTodayUtc.setUTCHours(0, 0, 0, 0);
    let autoBriefsToday: number;
    try {
      autoBriefsToday = await this.creativePackageRepository.countAutoLoopSince(
        tenantId,
        startOfTodayUtc.toISOString(),
      );
    } catch (caught) {
      this.logger.warn(
        `SchedulerService.runNeedCreativeCheck: countAutoLoopSince(${tenantId}) failed: ${String(caught)}`,
      );
      return { briefsCreated: 0 };
    }

    // AAOS LOOP UPGRADE, Sprint 8c — real, honest count of `creative_packages` rows this cycle
    // actually inserted, for `loop_runs.total_briefs_auto_generated` (Step 6).
    let briefsCreated = 0;

    for (const { listing, matched } of perListing) {
      const matchingPackages = packages.filter((pkg) => pkg.listingId === listing.id);
      const hasNormalAsset =
        matchingPackages.length > 0
          ? matchingPackages.some((pkg) => pkg.fatigueStatus === "NORMAL")
          : undefined;
      const inUseFatigueStatus =
        matchingPackages.find((pkg) => pkg.fatigueStatus === "FATIGUED")?.fatigueStatus ??
        matchingPackages.find((pkg) => pkg.fatigueStatus === "WARNING")?.fatigueStatus ??
        matchingPackages[0]?.fatigueStatus;
      const relevantVerdict = matched.verdicts.find(
        (v) => v === Verdict.SCALE || v === Verdict.FIX,
      );

      const evaluation = evaluateNeedCreative({
        ...(relevantVerdict !== undefined ? { verdict: relevantVerdict } : {}),
        ...(hasNormalAsset !== undefined ? { hasNormalAsset } : {}),
        ...(inUseFatigueStatus !== undefined ? { inUseFatigueStatus } : {}),
      });
      if (!evaluation.triggered) {
        continue;
      }

      const guardrail = decideCreativeBriefGuardrail({
        mode,
        autoApproveEnabled: autoApproveCreativeBrief,
        autoBriefsToday,
        maxAutoBriefsPerDay,
      });
      if (!guardrail.allowed) {
        this.logger.log(
          `SchedulerService.runNeedCreativeCheck: skipped auto-brief for listing ${listing.id} — ${guardrail.reason}`,
        );
        continue;
      }

      // Honest angle basis: reuse the angle of the listing's own most-recently-created matching
      // package (the real asset this brief is meant to REFRESH) — never a fabricated "recommended"
      // angle (see `evaluateNeedCreative`'s own doc on why condition (a) cannot honestly compute
      // one). By construction (both trigger conditions require `matchingPackages.length > 0`),
      // this is always defined when `evaluation.triggered` is `true`.
      const angleBasis = matchingPackages[0]?.angle ?? "READY_HUNI";

      try {
        const pkg = await this.creativePackageRepository.create({
          id: randomUUID(),
          tenantId,
          briefId: randomUUID(),
          vertical: "PROPERTY",
          listingId: listing.id,
          title: `[Auto] Refresh kreatif — ${listing.title}`,
          angle: angleBasis,
          reason: evaluation.reason ?? "NEED_CREATIVE terdeteksi oleh Samantha.",
          requestedFormat: "IMAGES_ONLY",
          primaryMessage: listing.title,
          urgency: "MEDIUM",
          origin: "SAMANTHA",
          source: "auto_loop",
          relatedVerdictId: listing.id,
          priority: relevantVerdict === Verdict.SCALE ? "HIGH" : "MEDIUM",
          initialStatus: guardrail.status,
        });

        await this.auditLog.record({
          tenantId,
          agent: "SAMANTHA",
          actionType: "CREATIVE_BRIEF_CREATED",
          beforeState: null,
          afterState: { creativePackageId: pkg.id, status: pkg.status },
          decidedBy: "ai_auto",
          mode,
          relatedVerdictId: listing.id,
          relatedBriefId: pkg.id,
          reversible: false,
        });

        if (guardrail.status === "PENDING_REVIEW") {
          await this.pendingActions.enqueue({
            tenantId,
            agent: "SAMANTHA",
            actionType: "REVIEW_CREATIVE_BRIEF",
            payload: { listingId: listing.id, creativePackageId: pkg.id },
          });
        } else {
          // AAOS LOOP UPGRADE, Sprint 8b (Prompt 19 Step 4) — real auto-trigger, per the user's
          // explicit full-auto-trigger decision (see this dispatch's own coordinator note): a
          // `guardrail.status === "DRAFT"` row (LIVE mode + `auto_approve_creative_brief` ON) is
          // picked up for real Kie AI generation right here, with no further manual click.
          // Best-effort, same "never let a side-effect take down the whole listing loop" discipline
          // every other write in this method already follows — `triggerAutoLoopGeneration` itself
          // returns as soon as the row is `GENERATING` (the real Kie AI pipeline runs detached, same
          // as every other real generation call in `CreativePackagesService`), so this await is fast.
          try {
            await this.creativePackagesService.triggerAutoLoopGeneration(tenantId, pkg.id);
          } catch (caught) {
            this.logger.warn(
              `SchedulerService.runNeedCreativeCheck: triggerAutoLoopGeneration(${pkg.id}) failed to start: ${String(caught)}`,
            );
          }
        }

        autoBriefsToday += 1;
        briefsCreated += 1;
      } catch (caught) {
        this.logger.warn(
          `SchedulerService.runNeedCreativeCheck: auto-brief create failed for listing ${listing.id}: ${String(caught)}`,
        );
      }
    }

    return { briefsCreated };
  }

  /**
   * `runAndromedaRestructureCheck` (Samantha Andromeda-Aware Campaign System, Sprint 1) — real
   * per-campaign detection, reusing the SAME `matched.matchedCampaigns` (full real `Campaign` tree,
   * no second Meta pull) `runPropertyCampaignTriggerCheck` already computed above via
   * `matchActiveCampaignForListing`. For every real matched campaign: computes a real ad-set count
   * + `scoreCreativeDiversity` (`@aos/meta-ads-connector`) over every real ad across every real ad
   * set, then `evaluateAndromedaRestructureCandidate` (pure, `domain/andromeda-restructure.ts`).
   *
   * ABSOLUTE, NON-NEGOTIABLE SAFETY PROPERTY: when triggered, this method's ONLY real effect is
   * enqueuing a `RESTRUCTURE_CAMPAIGN` `pending_agent_actions` row via `this.pendingActions.enqueue`
   * — it NEVER calls `CampaignsService.restructureCampaign`/`connector.restructureCampaign`/any
   * other Meta-mutating code path, in ANY tenant mode, regardless of any toggle. There is no
   * mode/toggle branch here at all (unlike `runNeedCreativeCheck`/`runCampaignPublishCheck`, which
   * DO have a real auto-executing DEV/LIVE branch) — restructuring a LIVE campaign has no safe,
   * honest reverse operation, so the user's own explicit decision (this sprint's coordinator note)
   * is that ONLY a human's real Approve click on the enqueued row
   * (`PendingActionsService.approve()`'s `RESTRUCTURE_CAMPAIGN` branch) may ever invoke the real
   * `RestructureCampaign` Meta mutation. See `andromeda-restructure.spec.ts`'s own "SAFETY DEFAULT"
   * test and `pending-actions.service.spec.ts`'s own "SAFETY DEFAULT" test for the two halves of
   * this proof.
   *
   * De-duplication: a campaign that already has a real `PENDING` `RESTRUCTURE_CAMPAIGN` row is
   * skipped on subsequent ticks (checked via `this.pendingActions.listPending`) — this check runs
   * every `runPropertyCampaignTriggerCheck` cycle, same cadence `runFatigueCheck`/
   * `runNeedCreativeCheck` already use, so without this guard the SAME real low-diversity campaign
   * would enqueue a fresh duplicate row every tick.
   *
   * Best-effort per campaign, same "never let a side-check take down the whole handler" discipline
   * every other check in this file already establishes.
   */
  private async runAndromedaRestructureCheck(
    tenantId: string,
    perListing: readonly {
      readonly listing: ListingResponseDto;
      readonly matched: MatchedCampaignSignals;
    }[],
  ): Promise<{ readonly candidatesDetected: number }> {
    let existingPending: Awaited<ReturnType<PendingActionsService["listPending"]>>;
    try {
      existingPending = await this.pendingActions.listPending(tenantId, "PENDING");
    } catch (caught) {
      this.logger.warn(
        `SchedulerService.runAndromedaRestructureCheck: listPending(${tenantId}) failed: ${String(caught)}`,
      );
      return { candidatesDetected: 0 };
    }
    const alreadyPendingCampaignIds = new Set(
      existingPending
        .filter((row) => row.action_type === "RESTRUCTURE_CAMPAIGN")
        .map((row) => row.payload["campaignId"])
        .filter((id): id is string => typeof id === "string"),
    );

    let candidatesDetected = 0;
    const seenCampaignIds = new Set<string>();

    for (const { matched } of perListing) {
      for (const campaign of matched.matchedCampaigns) {
        const campaignId = campaign.id.toString();
        // A campaign can legitimately be re-matched across multiple listings (name-substring
        // heuristic) or, in principle, across this same perListing pass — never enqueue twice for
        // the same real campaign within one cycle.
        if (alreadyPendingCampaignIds.has(campaignId) || seenCampaignIds.has(campaignId)) {
          continue;
        }
        seenCampaignIds.add(campaignId);

        const adSetCount = campaign.adSets.length;
        const allAds = campaign.adSets.flatMap((adSet) => adSet.ads);
        const diversity: CreativeDiversityScore = scoreCreativeDiversity(allAds);
        const evaluation = evaluateAndromedaRestructureCandidate({ adSetCount, diversity });
        if (!evaluation.triggered) {
          continue;
        }

        // Honest, documented judgment call: propose KEEPING the real ad set with the highest
        // cumulative real spend (Meta has already invested the most delivery/learning into it) and
        // pausing every other real ad set — never a fabricated "best performer" from a signal this
        // app doesn't honestly have (e.g. no real per-ad-set ROAS exists anywhere in this app
        // today). `campaign.adSets` is non-empty here by construction (`evaluation.triggered` can
        // only be `true` when `adSetCount >= MIN_AD_SETS_FOR_RESTRUCTURE_CANDIDATE`, i.e. >= 2).
        const bestAdSet = campaign.adSets.reduce((best, candidate) =>
          candidate.spend.toNumber() > best.spend.toNumber() ? candidate : best,
        );
        const proposedPauseAdSetIds = campaign.adSets
          .filter((adSet) => adSet.id.toString() !== bestAdSet.id.toString())
          .map((adSet) => adSet.id.toString());

        try {
          // The ONE real effect of a trigger — enqueue for mandatory human review. See this
          // method's own doc for why there is deliberately no other branch here.
          await this.pendingActions.enqueue({
            tenantId,
            agent: "SAMANTHA",
            actionType: "RESTRUCTURE_CAMPAIGN",
            payload: {
              campaignId,
              campaignName: campaign.name,
              currentAdSetCount: adSetCount,
              proposedKeepAdSetId: bestAdSet.id.toString(),
              proposedPauseAdSetIds,
              diversityStatus: diversity.status,
              diversityReasoning: diversity.reasoning,
              reason: evaluation.reason,
            },
          });
          candidatesDetected += 1;

          await this.auditLog.record({
            tenantId,
            agent: "SAMANTHA",
            actionType: "ANDROMEDA_RESTRUCTURE_DETECTED",
            beforeState: null,
            afterState: { campaignId, adSetCount, diversityStatus: diversity.status },
            decidedBy: "ai_auto",
            mode: await this.modeGuard.resolveMode(tenantId),
            relatedVerdictId: campaignId,
            reversible: false,
          });
        } catch (caught) {
          this.logger.warn(
            `SchedulerService.runAndromedaRestructureCheck: enqueue failed for campaign ${campaignId}: ${String(caught)}`,
          );
        }
      }
    }

    return { candidatesDetected };
  }

  /**
   * `createDiverseCreativeBriefSet` (Samantha Andromeda-Aware Campaign System, Sprint 2) — Kai's
   * diverse-creative-set brief generation, real endpoint entry point for
   * `POST /api/v1/creative-packages/diverse-set` (`CreativeDiverseSetController`, below in this
   * module). Lives on `SchedulerService`, not `CreativePackagesService`, for one real, investigated
   * reason: this orchestration needs `PropertyObjectiveService` (the real daily-cap settings),
   * `PendingActionsService` (the real `REVIEW_CREATIVE_BRIEF` enqueue), AND `CreativePackagesService`
   * (the real `triggerAutoLoopGeneration` auto-trigger) all at once — the EXACT SAME 3-way
   * dependency `runNeedCreativeCheck` (above) already has, and `SchedulerModule` already imports all
   * 3 modules (`PropertyObjectiveModule`/`PendingActionsModule`/`CreativePackagesModule`) with no
   * circular-import risk (verified directly). `CreativePackagesModule` itself cannot inject
   * `PendingActionsService` — `PendingActionsModule` already imports `CreativePackagesModule` (see
   * that module's own doc), so the reverse import would be circular.
   *
   * REAL, HONEST DAILY-CAP INTERACTION (per this dispatch's own explicit scope note: "the honest
   * behavior is to generate only as many as the real cap allows, never silently ignore it"): reads
   * the SAME real `PropertyObjectiveService.getAutoLoopSettingsSafe`/
   * `CreativePackageRepository.countAutoLoopSince` `runNeedCreativeCheck` already reads, computes
   * `remaining = max(0, maxAutoBriefsPerDay - autoBriefsToday)` BEFORE ever calling the LLM, and
   * clamps the real LLM/fallback request to `min(requestedCount, remaining,
   * MAX_DIVERSE_BRIEF_COUNT)`. `remaining <= 0` short-circuits to a real, honest
   * `createdCount: 0`/`skippedReason` WITHOUT spending an LLM call — never silently drops the
   * request while pretending to have honored it. Every individual package this method creates STILL
   * runs back through `decideCreativeBriefGuardrail` per-package (same as `runNeedCreativeCheck`'s
   * own loop) — the pre-clamp is an honest capacity computation, not a bypass of the real per-package
   * guardrail chain.
   *
   * REAL DIVERSITY REQUIREMENT: `existingAngles` is the real, already-in-use set of `PropertyAdAngle`
   * members among this listing's own existing `creative_packages` rows (the same
   * `packages.filter((pkg) => pkg.listingId === listing.id)` pattern `runNeedCreativeCheck` already
   * establishes) — threaded into `LlmService.generateDiverseCreativeBriefSet` so a new batch never
   * requests angles the campaign already has plenty of.
   *
   * HONEST FALLBACK: when the LLM call returns `available: false` (any reason), this degrades to a
   * real DETERMINISTIC angle pick — the first `effectiveTarget` real `PropertyAdAngle` members (in
   * `ALL_PROPERTY_AD_ANGLE_VALUES`'s own declared order) not already in `existingAngles` — never a
   * fabricated LLM-shaped brief. A fallback brief's `headline`/`primaryText` are honest, minimal,
   * listing-derived strings (not a template-generated 3-variant set like `PropertyCopyBuilder`
   * produces — this method creates DRAFT/PENDING_REVIEW briefs, not final ad copy; real copy is
   * generated later by `CreativePackagesService.generateProperty`'s own existing
   * `buildPropertyCopyVariants` pipeline, unchanged by this dispatch).
   */
  async createDiverseCreativeBriefSet(
    tenantId: string,
    listingId: string,
    requestedCount: number,
    campaignId?: string,
  ): Promise<DiverseCreativeBriefSetResultDto> {
    const listing = await this.listingsService.getById(tenantId, listingId);

    const mode = await this.modeGuard.resolveMode(tenantId);
    const { maxAutoBriefsPerDay, autoApproveCreativeBrief } =
      await this.propertyObjectiveService.getAutoLoopSettingsSafe(tenantId);

    const startOfTodayUtc = new Date();
    startOfTodayUtc.setUTCHours(0, 0, 0, 0);
    let autoBriefsToday = await this.creativePackageRepository.countAutoLoopSince(
      tenantId,
      startOfTodayUtc.toISOString(),
    );

    const remaining = Math.max(0, maxAutoBriefsPerDay - autoBriefsToday);
    const effectiveTarget = Math.min(requestedCount, remaining, MAX_DIVERSE_BRIEF_COUNT);
    if (effectiveTarget <= 0) {
      return {
        requestedCount,
        allowedCount: 0,
        cappedByDailyLimit: true,
        createdCount: 0,
        packages: [],
        skippedReason: `Sudah ${String(autoBriefsToday)} auto-brief hari ini (batas ${String(maxAutoBriefsPerDay)}) — tidak ada sisa kuota untuk brief baru hari ini.`,
      };
    }

    const existingPackages = await this.creativePackageRepository.list(tenantId, { limit: 200 });
    const existingAngles = [
      ...new Set(
        existingPackages
          .filter((pkg) => pkg.listingId === listing.id)
          .map((pkg) => pkg.angle)
          .filter((angle): angle is (typeof ALL_PROPERTY_AD_ANGLE_VALUES)[number] =>
            (ALL_PROPERTY_AD_ANGLE_VALUES as readonly string[]).includes(angle),
          ),
      ),
    ];

    const llmRequest: DiverseCreativeBriefSetRequestDto = {
      listingTitle: listing.title,
      propertyType: listing.propertyType,
      targetCount: effectiveTarget,
      existingAngles,
      price: listing.price,
      ...(listing.city !== undefined ? { city: listing.city } : {}),
      ...(listing.highlights.length > 0 ? { highlights: [...listing.highlights] } : {}),
    };

    let briefs: ReadonlyArray<{
      readonly angle: string;
      readonly format: "VIDEO_AND_IMAGES" | "IMAGES_ONLY";
      readonly headline: string;
      readonly primaryText: string;
      readonly description: string;
    }>;
    try {
      const llmResult = await this.llmService.generateDiverseCreativeBriefSet(tenantId, llmRequest);
      if (llmResult.available) {
        briefs = llmResult.briefs;
      } else {
        this.logger.warn(
          `SchedulerService.createDiverseCreativeBriefSet(${listingId}): LLM generation unavailable (${llmResult.reason}), falling back to a deterministic angle pick.`,
        );
        briefs = deterministicDiverseBriefFallback(listing, existingAngles, effectiveTarget);
      }
    } catch (caught) {
      this.logger.warn(
        `SchedulerService.createDiverseCreativeBriefSet(${listingId}): LLM generation threw, falling back to a deterministic angle pick: ${String(caught)}`,
      );
      briefs = deterministicDiverseBriefFallback(listing, existingAngles, effectiveTarget);
    }

    if (briefs.length === 0) {
      return {
        requestedCount,
        allowedCount: effectiveTarget,
        cappedByDailyLimit: requestedCount > remaining,
        createdCount: 0,
        packages: [],
        skippedReason:
          "Semua real PropertyAdAngle sudah dipakai campaign ini — tidak ada angle baru yang jujur bisa dibuat.",
      };
    }

    const created: StoredCreativePackage[] = [];
    for (const brief of briefs) {
      const guardrail = decideCreativeBriefGuardrail({
        mode,
        autoApproveEnabled: autoApproveCreativeBrief,
        autoBriefsToday,
        maxAutoBriefsPerDay,
      });
      if (!guardrail.allowed) {
        this.logger.log(
          `SchedulerService.createDiverseCreativeBriefSet(${listingId}): skipped angle ${brief.angle} — ${guardrail.reason}`,
        );
        break;
      }

      try {
        const pkg = await this.creativePackageRepository.create({
          id: randomUUID(),
          tenantId,
          briefId: randomUUID(),
          vertical: "PROPERTY",
          listingId: listing.id,
          title: brief.headline,
          angle: brief.angle,
          reason: `Kai diverse-creative-set brief (Andromeda Health)${campaignId !== undefined ? ` — campaign ${campaignId}` : ""}: ${brief.description}`,
          requestedFormat: brief.format,
          primaryMessage: brief.primaryText,
          urgency: "MEDIUM",
          origin: "SAMANTHA",
          source: "auto_loop",
          ...(campaignId !== undefined ? { relatedVerdictId: campaignId } : {}),
          priority: "MEDIUM",
          initialStatus: guardrail.status,
        });

        await this.auditLog.record({
          tenantId,
          agent: "SAMANTHA",
          actionType: "CREATIVE_BRIEF_CREATED",
          beforeState: null,
          afterState: { creativePackageId: pkg.id, status: pkg.status, angle: pkg.angle },
          decidedBy: "ai_auto",
          mode,
          relatedVerdictId: listing.id,
          relatedBriefId: pkg.id,
          reversible: false,
        });

        if (guardrail.status === "PENDING_REVIEW") {
          await this.pendingActions.enqueue({
            tenantId,
            agent: "SAMANTHA",
            actionType: "REVIEW_CREATIVE_BRIEF",
            payload: { listingId: listing.id, creativePackageId: pkg.id },
          });
        } else {
          try {
            await this.creativePackagesService.triggerAutoLoopGeneration(tenantId, pkg.id);
          } catch (caught) {
            this.logger.warn(
              `SchedulerService.createDiverseCreativeBriefSet(${listingId}): triggerAutoLoopGeneration(${pkg.id}) failed to start: ${String(caught)}`,
            );
          }
        }

        autoBriefsToday += 1;
        created.push(pkg);
      } catch (caught) {
        this.logger.warn(
          `SchedulerService.createDiverseCreativeBriefSet(${listingId}): create failed for angle ${brief.angle}: ${String(caught)}`,
        );
      }
    }

    return {
      requestedCount,
      allowedCount: effectiveTarget,
      cappedByDailyLimit: requestedCount > remaining,
      createdCount: created.length,
      packages: created.map(toCreativePackageResponseDto),
      ...(created.length === 0
        ? { skippedReason: "Guardrail harian menolak setiap brief pada batch ini." }
        : {}),
    };
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
  ): Promise<string | undefined> {
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
      return activityId;
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

      // AAOS LOOP UPGRADE, Sprint 6 Prompt 17 — real audit_log write, ONLY for a genuine
      // non-simulated real Meta campaign publish (never a DEV-mode `SIMULATED` result — nothing
      // real happened yet to audit). `reversible: true` — the real, safe reverse operation is
      // `MetaAdsService.executeVerdict({verdict: 'PAUSE', targetType: 'campaign'})` against this
      // same real `campaignId` (see `AuditLogService.rollback`'s own doc).
      if (!result.simulated && result.campaignId !== undefined) {
        await this.auditLog.record({
          tenantId,
          agent: "SAMANTHA",
          actionType: "CAMPAIGN_PUBLISHED",
          beforeState: null,
          afterState: result,
          decidedBy: "ai_auto",
          mode,
          relatedVerdictId: activityId,
          reversible: true,
        });
      }
    } catch (error) {
      await this.activityLogger.fail(activityId, error);
      throw error;
    }
    return activityId;
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
  /**
   * AAOS LOOP UPGRADE, Sprint 8a — every real per-ad `Verdict` (`ad.verdict`, already computed
   * upstream, the SAME value `toAnalyzeCampaigns` reports) across this listing's matched active
   * campaign(s) — the real input `evaluateNeedCreative`'s condition (a) needs. Empty array (not
   * `undefined`) when a campaign matched but has zero ads; `undefined` semantics are reserved for
   * "no matched campaign at all", handled by `hasActiveCampaign: false` instead.
   */
  readonly verdicts: readonly Verdict[];
  /**
   * Samantha Andromeda-Aware Campaign System, Sprint 1 — the real, already-loaded `Campaign`
   * entities (full `adSets`/`ads` tree, no second Meta pull) that matched this listing, reused by
   * `runAndromedaRestructureCheck` to compute a real per-campaign ad-set count + creative
   * diversity score. Empty array when `hasActiveCampaign` is `false`.
   */
  readonly matchedCampaigns: readonly Campaign[];
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
  const verdicts: Verdict[] = [];
  const matchedCampaigns: Campaign[] = [];

  const isMatch = (campaign: Campaign): boolean =>
    campaign.status === AdStatus.ACTIVE && campaign.name.toLowerCase().includes(needle);

  for (const account of adAccounts) {
    for (const campaign of account.campaigns) {
      if (!isMatch(campaign)) {
        continue;
      }
      hasActiveCampaign = true;
      matchedCampaigns.push(campaign);
      for (const adSet of campaign.adSets) {
        for (const ad of adSet.ads) {
          maxFrequency =
            maxFrequency === undefined
              ? ad.metrics.frequency
              : Math.max(maxFrequency, ad.metrics.frequency);
          totalSpend += ad.metrics.spend.toNumber();
          totalLeads += ad.metrics.totalLead;
          verdicts.push(ad.verdict);
        }
      }
    }
  }

  const cplIDR = totalLeads > 0 ? totalSpend / totalLeads : undefined;
  return {
    hasActiveCampaign,
    ...(maxFrequency !== undefined ? { maxFrequency } : {}),
    ...(cplIDR !== undefined ? { cplIDR } : {}),
    verdicts,
    matchedCampaigns,
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

/**
 * `createDiverseCreativeBriefSet`'s honest deterministic fallback when
 * `LlmService.generateDiverseCreativeBriefSet` returns `available: false` (any reason) — the first
 * `effectiveTarget` real `PropertyAdAngle` members (in `ALL_PROPERTY_AD_ANGLE_VALUES`'s own declared
 * order) not already in `existingAngles`. Every field is derived only from real `listing` data —
 * never a fabricated price/highlight. `format` is a fixed, conservative `IMAGES_ONLY` (no LLM
 * judgment available to decide video-worthiness) — matches `runNeedCreativeCheck`'s own real
 * `requestedFormat: "IMAGES_ONLY"` fallback default for its own auto-loop brief.
 */
function deterministicDiverseBriefFallback(
  listing: ListingResponseDto,
  existingAngles: readonly string[],
  effectiveTarget: number,
): ReadonlyArray<{
  readonly angle: string;
  readonly format: "VIDEO_AND_IMAGES" | "IMAGES_ONLY";
  readonly headline: string;
  readonly primaryText: string;
  readonly description: string;
}> {
  const existing = new Set(existingAngles);
  const unusedAngles = ALL_PROPERTY_AD_ANGLE_VALUES.filter((angle) => !existing.has(angle));
  return unusedAngles.slice(0, effectiveTarget).map((angle) => ({
    angle,
    format: "IMAGES_ONLY" as const,
    headline: `${listing.title} — ${angle}`,
    primaryText: listing.title,
    description: `Brief otomatis (fallback deterministik, AI tidak tersedia) untuk angle ${angle}.`,
  }));
}

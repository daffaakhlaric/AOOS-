import "reflect-metadata";

import { NotFoundError } from "@aos/errors";
import type { LeadStore } from "@aos/lead-store";
import {
  AdBuilder,
  AdMetrics,
  AdSetBuilder,
  CampaignBuilder,
  Spend,
  Verdict,
  type AdAccount,
  type MetaAdsConnector,
} from "@aos/meta-ads-connector";
import type { MobixScraperService } from "@aos/mobix-web-scraper";
import type { ObjectiveEngine } from "@aos/objective-engine";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createFakeSupabaseClient,
  type FakeSupabaseClient,
} from "../../test-support/fake-supabase-client.js";
import { buildTestConfig } from "../../test-support/fixtures.js";
import type { AbTestingService } from "../abtesting/abtesting.service.js";
import type { ActivityLogger } from "../activity-log/activity-logger.service.js";
import type { AgentConfigService } from "../agent-config/agent-config.service.js";
import type { AgentLogicService } from "../agent-config/agent-logic.service.js";
import { AgentRunsService } from "../agent-runs/agent-runs.service.js";
import { AgentRunRepository } from "../agent-runs/infrastructure/agent-run.repository.js";
import type { AiJudgeService } from "../ai-judge/ai-judge.service.js";
import type { AuditLogService } from "../audit-log/audit-log.service.js";
import type { CampaignsService } from "../campaigns/campaigns.service.js";
import type { CreatePropertyCampaignResponseDto } from "../campaigns/dto/create-property-campaign.dto.js";
import type { CreativePackageRepository } from "../creative-packages/infrastructure/creative-package.repository.js";
import type { IntelligenceService } from "../intelligence/intelligence.service.js";
import type { ListingListResponseDto } from "../listings/dto/listing.dto.js";
import type { ListingsService } from "../listings/listings.service.js";
import type { LlmService } from "../llm/llm.service.js";
import type { LookalikeService } from "../lookalike/lookalike.service.js";
import type { MarketIntelligenceService } from "../market-intelligence/market-intelligence.service.js";
import type { AdTenantIndexRepository } from "../meta-ads/infrastructure/ad-tenant-index.repository.js";
import type { ModeGuardService } from "../mode-guard/mode-guard.service.js";
import type { PendingActionRow } from "../pending-actions/infrastructure/pending-action.repository.js";
import type { PendingActionsService } from "../pending-actions/pending-actions.service.js";
import type { PropertyObjectiveService } from "../property-objective/property-objective.service.js";
import type { RecyclingRunResult, RecyclingService } from "../recycling/recycling.service.js";
import type { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";

import type { CalendarEventResult, StoredCalendarEvent } from "./domain/calendar-event.js";
import type { CalendarEventRepository } from "./infrastructure/calendar-event.repository.js";
import { SchedulerService, nextOccurrence, resolveCalendarRange } from "./scheduler.service.js";

function unwrap<T>(result: { ok: boolean; value?: T; error?: unknown }): T {
  if (!result.ok) {
    throw new Error(`unwrap failed: ${JSON.stringify(result.error)}`);
  }
  return result.value as T;
}

function buildAdAccount(): AdAccount {
  const ad = unwrap(new AdBuilder().build());
  const adSet = unwrap(new AdSetBuilder().withAds([ad]).build());
  const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
  return {
    id: campaign.adSets[0]?.adAccountId,
    name: "Test Ad Account",
    businessManagerId: "bm_1",
    currency: "IDR",
    timezone: "Asia/Jakarta",
    campaigns: [campaign],
    syncedAt: new Date("2026-08-18T00:00:00.000Z"),
  } as unknown as AdAccount;
}

function buildEvent(overrides: Partial<StoredCalendarEvent> = {}): StoredCalendarEvent {
  return {
    id: "evt-1",
    tenantId: "dss-motor",
    eventType: "SCRAPER_RUN",
    title: "Scrape Foto Mobix",
    scheduledAt: "2026-08-19T06:00:00.000Z",
    timezone: "Asia/Jakarta",
    recurrence: "ONCE",
    status: "PENDING",
    createdBy: "system",
    createdAt: "2026-08-18T00:00:00.000Z",
    ...overrides,
  };
}

function buildFakeRepository(
  overrides: Partial<CalendarEventRepository> = {},
): CalendarEventRepository {
  return {
    create: vi.fn(async (input: { id: string }) => buildEvent({ id: input.id })),
    findById: vi.fn(async () => buildEvent()),
    listByRange: vi.fn(async () => []),
    listDuePending: vi.fn(async () => []),
    update: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    markRunning: vi.fn(async () => undefined),
    markDone: vi.fn(async () => undefined),
    markFailed: vi.fn(async () => undefined),
    markSkipped: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as CalendarEventRepository;
}

function buildFakeConnector(adAccount: AdAccount = buildAdAccount(), ok = true): MetaAdsConnector {
  return {
    pullCampaignData: {
      execute: vi.fn(async () =>
        ok ? { ok: true, value: adAccount } : { ok: false, error: new Error("meta down") },
      ),
    },
    executeVerdict: { execute: vi.fn() },
    client: {},
  } as unknown as MetaAdsConnector;
}

function buildFakeAdTenantIndex(): AdTenantIndexRepository {
  return {
    upsertMany: vi.fn(async () => undefined),
    findTenantByAdMetaId: vi.fn(async () => undefined),
  } as unknown as AdTenantIndexRepository;
}

function buildFakeTenantRepository(
  rows: readonly {
    readonly tenant_id: string;
    readonly status: string;
    readonly vertical?: string;
    /** AAOS-OPERATING-MODE-APPROVAL-GATE — deliberately omittable: a row with no `operating_mode` field at all (like every pre-existing fixture in this file) exercises the exact real "tenant row from before the migration ran" zero-regression fallback (`tenant.operating_mode ?? "FULL_CONTROL"`). */
    readonly operating_mode?: string;
  }[] = [{ tenant_id: "dss-motor", status: "ACTIVE", vertical: "AUTOMOTIVE" }],
): TenantRepository {
  return {
    list: vi.fn(async () => rows),
    findByTenantId: vi.fn(async (tenantId: string) =>
      rows.find((row) => row.tenant_id === tenantId),
    ),
  } as unknown as TenantRepository;
}

function buildFakeListingsService(
  listings: ListingListResponseDto["listings"] = [],
): ListingsService {
  return {
    list: vi.fn(async () => ({ listings, total: listings.length })),
  } as unknown as ListingsService;
}

/**
 * AAOS EPIC S, Phase S5 — `SchedulerService` no longer resolves the target location itself
 * (`CampaignsService.createPropertyCampaign` does that internally now); this fake stands in for
 * the real `createPropertyCampaign`, which the scheduler now calls directly for every real
 * `shouldCreateNewCampaign` trigger.
 */
function buildFakeCampaignsService(
  impl?: (
    tenantId: string,
    body: { listingId: string },
    correlationId: string,
  ) => Promise<CreatePropertyCampaignResponseDto>,
): CampaignsService {
  return {
    createPropertyCampaign: vi.fn(
      impl ??
        (async () => ({
          simulated: false,
          resolvedCities: ["Jakarta"],
          campaignId: "campaign-1",
          adSetId: "adset-1",
        })),
    ),
  } as unknown as CampaignsService;
}

/** AAOS-OPERATING-MODE-APPROVAL-GATE — a fake `PendingActionsService`; `enqueue` returns a real, deterministic id so tests can assert `ActivityLogger.escalate`'s real `output.pendingActionId`. */
function buildFakePendingActionsService(
  enqueue: PendingActionsService["enqueue"] = vi.fn(async () => "pending-1"),
): PendingActionsService {
  return {
    enqueue,
    listPending: vi.fn(async () => [] as readonly PendingActionRow[]),
    approve: vi.fn(),
    reject: vi.fn(),
  } as unknown as PendingActionsService;
}

/** AAOS Self-Improving (Phase SI-1) — a fake `AgentConfigService` that always resolves to the caller's own `fallback` (the exact real default-passthrough behavior `AgentConfigService.get` documents on itself for "no override row exists yet"), so every test that doesn't care about `pause_cpl_multiplier` keeps exercising `HIGH_CPL_MULTIPLIER`'s real default value unchanged. */
function buildFakeAgentConfigService(
  get: AgentConfigService["get"] = vi.fn(
    async (_tenantId: string, _agent: string, _key: string, fallback: number) => fallback,
  ),
): AgentConfigService {
  return {
    get,
    set: vi.fn(async () => ({}) as never),
  } as unknown as AgentConfigService;
}

/** AAOS Self-Improving (Phase SI-2) — a fake `AgentLogicService` that always resolves `undefined` by default (the exact real "no override row exists yet" behavior `AgentLogicService.get` documents on itself), so every existing test that doesn't care about `verdict_classification` keeps exercising `resolveVerdictOverride`'s real zero-behavior-change default (every ad keeps its real, unmodified `verdict`). */
function buildFakeAgentLogicService(
  get: AgentLogicService["get"] = vi.fn(async () => undefined),
): AgentLogicService {
  return {
    get,
    set: vi.fn(async () => ({}) as never),
  } as unknown as AgentLogicService;
}

function buildFakeModeGuardService(mode: "DEV" | "LIVE" = "LIVE"): ModeGuardService {
  return {
    resolveMode: vi.fn(async () => mode),
    executeOrSimulate: vi.fn(
      async (_tenantId: string, executeFn: () => unknown, simulateFn: () => unknown) =>
        mode === "DEV" ? simulateFn() : executeFn(),
    ),
  } as unknown as ModeGuardService;
}

/**
 * AAOS-AI-JUDGE-SELF-IMPROVING (Phase J1) — a REAL `AgentRunsService` over a real
 * `AgentRunRepository`/fake Supabase client (not a `vi.fn()` stub), so tests can assert the actual
 * persisted `agent_runs` row shape and exercise the real best-effort discipline end-to-end (a
 * `forceErrorOnce("agent_runs", ...)` failure must never abort the real caller).
 */
function buildRealAgentRunsService(client: FakeSupabaseClient = createFakeSupabaseClient()): {
  readonly client: FakeSupabaseClient;
  readonly agentRunsService: AgentRunsService;
} {
  return { client, agentRunsService: new AgentRunsService(new AgentRunRepository(client)) };
}

function buildFakeActivityLogger(): ActivityLogger {
  return {
    start: vi.fn(async () => "activity-1"),
    logToolCall: vi.fn(async () => undefined),
    logReasoning: vi.fn(async () => undefined),
    complete: vi.fn(async () => undefined),
    escalate: vi.fn(async () => undefined),
    fail: vi.fn(async () => undefined),
  } as unknown as ActivityLogger;
}

function buildFakeScraper(ok = true): MobixScraperService {
  return {
    runFullScrape: vi.fn(async () =>
      ok
        ? {
            ok: true,
            value: {
              session: { units: [{}, {}] },
              diff: { newUnits: [{}], soldUnits: [] },
              photoResults: [{ succeeded: [{}, {}, {}], failed: [] }],
            },
          }
        : { ok: false, error: new Error("scrape failed") },
    ),
  } as unknown as MobixScraperService;
}

function buildFakeObjectiveEngine(hasObjective = true): ObjectiveEngine {
  const objective = {
    id: "obj-1",
    tenantId: "dss-motor",
    targetHotLeads: { toNumber: () => 100 },
    budgetAllocation: { toNumber: () => 10_000_000 },
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
  };
  const progress = {
    currentHotLeads: 42,
    currentSpend: { toNumber: () => 3_000_000 },
    daysElapsed: 18,
    daysRemaining: 13,
    progressPercentage: { toNumber: () => 42 },
    dailyRunRate: 2.3,
    requiredDailyRunRate: 3.1,
    forecastedHotLeads: { toNumber: () => 65 },
    budgetBurnRate: 166_666,
    projectedBudgetAtEnd: { toNumber: () => 9_000_000 },
    onTrackStatus: "ON_TRACK",
  };
  return {
    registry: { listByTenant: vi.fn(() => (hasObjective ? [objective] : [])) },
    updateProgress: { execute: vi.fn(async () => ({ ok: true, value: progress })) },
  } as unknown as ObjectiveEngine;
}

function buildFakeLeadStore(hotLeadsPerBranch = 1): LeadStore {
  return {
    getHotLeads: {
      execute: vi.fn(async () => ({ ok: true, value: Array.from({ length: hotLeadsPerBranch }) })),
    },
  } as unknown as LeadStore;
}

function buildFakeLlmService(): LlmService {
  return {
    analyze: vi.fn(async () => ({
      available: true,
      temuan: [],
      rekomendasi: [],
      ringkasan: "ok",
    })),
  } as unknown as LlmService;
}

/** A fake `AiJudgeService` — `judgeRun`'s own real behavior is exercised on its own in `modules/ai-judge/ai-judge.service.spec.ts`; here we only need to verify `SchedulerService`'s real WIRING. */
function buildFakeAiJudgeService(
  judgeRun: (tenantId: string, agentRunId: string) => Promise<void> = async () => undefined,
): AiJudgeService {
  return { judgeRun: vi.fn(judgeRun) } as unknown as AiJudgeService;
}

function buildFakeRecyclingService(result?: RecyclingRunResult): RecyclingService {
  return {
    runRecyclingRun: vi.fn(
      async () => result ?? { summary: "2 broadcast terkirim", attempted: 2, sent: 2, failed: 0 },
    ),
  } as unknown as RecyclingService;
}

function buildFakeAbTestingService(
  result?: CalendarEventResult,
  completedTests: readonly {
    readonly name: string;
    readonly completedAt?: string;
    readonly improvementPct?: number;
  }[] = [],
): AbTestingService {
  return {
    runAbTestCheck: vi.fn(
      async () =>
        result ?? {
          summary: "0 test di-launch · 0 winner ditemukan",
          launched: 0,
          winnersDeclared: 0,
        },
    ),
    listTests: vi.fn(async (_status?: string) => completedTests),
  } as unknown as AbTestingService;
}

function buildFakeLookalikeService(result?: CalendarEventResult): LookalikeService {
  return {
    runLookalikeSync: vi.fn(
      async () =>
        result ?? {
          summary: "0 hot leads baru untuk disync",
          newlySynced: 0,
          totalSynced: 0,
        },
    ),
    getStatus: vi.fn(async () => ({
      totalHotLeads: 0,
      syncedToMetaAudience: 0,
      minRequiredForLookalike: 100,
      progressPercentage: 0,
      lookalikeEligible: false,
    })),
  } as unknown as LookalikeService;
}

function buildFakeIntelligenceService(result?: CalendarEventResult): IntelligenceService {
  return {
    refresh: vi.fn(
      async () =>
        result ?? {
          id: "sig-1",
          branchId: null,
          seasonal: { isSpecialPeriod: false },
          trends: { available: false },
          competitor: { available: false },
          inventory: { available: false },
          leadProfile: { totalLeads: 0 },
          closing: { totalEvents: 0 },
          campaignStrategy: { available: false, reason: "NO_API_KEY", message: "x" },
          digestText: "digest",
          generatedAt: "2026-08-19T06:00:00.000Z",
        },
    ),
    getLatest: vi.fn(async () => undefined),
  } as unknown as IntelligenceService;
}

function buildFakeMarketIntelligenceService(
  result?: CalendarEventResult,
): MarketIntelligenceService {
  return {
    refresh: vi.fn(
      async () =>
        result ?? {
          id: "mkt-1",
          vertical: "PROPERTY",
          searchTrend: { available: false, reason: "circuit breaker terbuka" },
          competitorAngleTrend: { available: false, reason: "META_APP_ID belum dikonfigurasi" },
          kprRate: { available: false, reason: "belum dikonfigurasi" },
          seasonality: { available: true, status: "musim sepi", note: "musim sepi properti" },
          digestText: "digest",
          generatedAt: "2026-08-19T07:00:00.000Z",
        },
    ),
    getLatest: vi.fn(async () => undefined),
  } as unknown as MarketIntelligenceService;
}

function buildFakeAuditLogService(): AuditLogService {
  return {
    record: vi.fn(async () => undefined),
    list: vi.fn(async () => []),
    get: vi.fn(async () => {
      throw new Error("not found");
    }),
    rollback: vi.fn(async () => {
      throw new Error("not implemented in this fake");
    }),
  } as unknown as AuditLogService;
}

function buildFakePropertyObjectiveService(
  overrides: Partial<PropertyObjectiveService> = {},
): PropertyObjectiveService {
  return {
    getCurrentSafe: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as PropertyObjectiveService;
}

function buildFakeCreativePackageRepository(
  overrides: Partial<CreativePackageRepository> = {},
): CreativePackageRepository {
  return {
    list: vi.fn(async () => []),
    updateFatigueStatus: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as CreativePackageRepository;
}

function buildService(
  options: {
    repository?: CalendarEventRepository;
    connector?: MetaAdsConnector;
    scraper?: MobixScraperService;
    objectiveEngine?: ObjectiveEngine;
    leadStore?: LeadStore;
    llmService?: LlmService;
    recyclingService?: RecyclingService;
    abTestingService?: AbTestingService;
    lookalikeService?: LookalikeService;
    intelligenceService?: IntelligenceService;
    marketIntelligenceService?: MarketIntelligenceService;
    adTenantIndex?: AdTenantIndexRepository;
    tenants?: TenantRepository;
    listingsService?: ListingsService;
    modeGuard?: ModeGuardService;
    activityLogger?: ActivityLogger;
    campaignsService?: CampaignsService;
    agentRunsService?: AgentRunsService;
    aiJudgeService?: AiJudgeService;
    pendingActions?: PendingActionsService;
    agentConfigService?: AgentConfigService;
    agentLogicService?: AgentLogicService;
    auditLog?: AuditLogService;
    propertyObjectiveService?: PropertyObjectiveService;
    creativePackageRepository?: CreativePackageRepository;
  } = {},
): SchedulerService {
  const config = buildTestConfig();
  const publisher = { publish: vi.fn(async () => undefined) };
  const connector = options.connector ?? buildFakeConnector();
  const connectorRegistry = {
    resolve: vi.fn(async () => ({
      ok: true,
      value: {
        ...connector,
        accessToken: config.META_ACCESS_TOKEN,
        adAccountIds: config.META_AD_ACCOUNT_IDS,
      },
    })),
  };
  return new SchedulerService(
    config,
    connectorRegistry as never,
    options.scraper ?? buildFakeScraper(),
    options.objectiveEngine ?? buildFakeObjectiveEngine(),
    options.leadStore ?? buildFakeLeadStore(),
    publisher as never,
    options.llmService ?? buildFakeLlmService(),
    options.repository ?? buildFakeRepository(),
    options.recyclingService ?? buildFakeRecyclingService(),
    options.abTestingService ?? buildFakeAbTestingService(),
    options.lookalikeService ?? buildFakeLookalikeService(),
    options.intelligenceService ?? buildFakeIntelligenceService(),
    options.marketIntelligenceService ?? buildFakeMarketIntelligenceService(),
    options.adTenantIndex ?? buildFakeAdTenantIndex(),
    options.tenants ?? buildFakeTenantRepository(),
    options.listingsService ?? buildFakeListingsService(),
    options.modeGuard ?? buildFakeModeGuardService(),
    options.activityLogger ?? buildFakeActivityLogger(),
    options.campaignsService ?? buildFakeCampaignsService(),
    options.agentRunsService ?? buildRealAgentRunsService().agentRunsService,
    options.aiJudgeService ?? buildFakeAiJudgeService(),
    options.pendingActions ?? buildFakePendingActionsService(),
    options.agentConfigService ?? buildFakeAgentConfigService(),
    options.agentLogicService ?? buildFakeAgentLogicService(),
    options.auditLog ?? buildFakeAuditLogService(),
    options.propertyObjectiveService ?? buildFakePropertyObjectiveService(),
    options.creativePackageRepository ?? buildFakeCreativePackageRepository(),
  );
}

describe("SchedulerService.executeEvent", () => {
  it("marks a stray unsupported event type FAILED with an honest message", async () => {
    const repository = buildFakeRepository();
    const service = buildService({ repository });
    await service.executeEvent(buildEvent({ eventType: "CAMPAIGN_CREATE" }));

    expect(repository.markFailed).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.stringContaining("tidak didukung"),
    );
    expect(repository.markDone).not.toHaveBeenCalled();
  });

  it("SCRAPER_RUN calls the real RunFullScrape and marks DONE with a real summary", async () => {
    const repository = buildFakeRepository();
    const scraper = buildFakeScraper();
    const service = buildService({ repository, scraper });
    await service.executeEvent(buildEvent({ eventType: "SCRAPER_RUN" }));

    expect(scraper.runFullScrape).toHaveBeenCalled();
    expect(repository.markDone).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({ summary: expect.stringContaining("unit") }),
    );
  });

  it("SCRAPER_RUN failure marks FAILED", async () => {
    const repository = buildFakeRepository();
    const service = buildService({ repository, scraper: buildFakeScraper(false) });
    await service.executeEvent(buildEvent({ eventType: "SCRAPER_RUN" }));
    expect(repository.markFailed).toHaveBeenCalled();
  });

  it("SAMANTHA_PULL_DATA pulls campaigns and reports real counts", async () => {
    const repository = buildFakeRepository();
    const service = buildService({ repository });
    await service.executeEvent(buildEvent({ eventType: "SAMANTHA_PULL_DATA" }));

    expect(repository.markDone).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({ campaigns: 1, ads: 1 }),
    );
  });

  it("SAMANTHA_PULL_DATA fails the event when every ad account pull fails", async () => {
    const repository = buildFakeRepository();
    const service = buildService({
      repository,
      connector: buildFakeConnector(buildAdAccount(), false),
    });
    await service.executeEvent(buildEvent({ eventType: "SAMANTHA_PULL_DATA" }));
    expect(repository.markFailed).toHaveBeenCalled();
  });

  it("TAMARA_PULL_DATA (legacy pre-rename event type, still seeded on real rows) dispatches the same handler as SAMANTHA_PULL_DATA", async () => {
    const repository = buildFakeRepository();
    const service = buildService({ repository });
    await service.executeEvent(buildEvent({ eventType: "TAMARA_PULL_DATA" }));

    expect(repository.markDone).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({ campaigns: 1, ads: 1 }),
    );
  });

  it("SAMANTHA_ANALYZE aggregates real PAUSE/SCALE counts from ad verdicts", async () => {
    const ad = unwrap(new AdBuilder().withVerdict(Verdict.PAUSE).build());
    const adSet = unwrap(new AdSetBuilder().withAds([ad]).build());
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    const adAccount = {
      id: campaign.adSets[0]?.adAccountId,
      name: "Acc",
      businessManagerId: "bm",
      currency: "IDR",
      timezone: "Asia/Jakarta",
      campaigns: [campaign],
      syncedAt: new Date(),
    } as unknown as AdAccount;

    const repository = buildFakeRepository();
    const service = buildService({ repository, connector: buildFakeConnector(adAccount) });
    await service.executeEvent(buildEvent({ eventType: "SAMANTHA_ANALYZE" }));

    expect(repository.markDone).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({ pause: 1, scale: 0, totalAds: 1 }),
    );
  });

  describe("SAMANTHA_ANALYZE PAUSE/SCALE digest — AAOS Self-Improving (Phase SI-2) real, optional agent_logic override", () => {
    function buildPauseAdAccount(rphChatIDR: number, conversations: number): AdAccount {
      const metrics = unwrap(
        AdMetrics.create({
          spend: unwrap(Spend.create(rphChatIDR * conversations)),
          impressions: 0,
          reach: 0,
          clicks: 0,
          conversations,
          d2: 0,
          d3: 0,
          d5: 0,
          leadForm: 0,
        }),
      );
      const ad = unwrap(new AdBuilder().withVerdict(Verdict.PAUSE).withMetrics(metrics).build());
      const adSet = unwrap(new AdSetBuilder().withAds([ad]).build());
      const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
      return {
        id: campaign.adSets[0]?.adAccountId,
        name: "Acc",
        businessManagerId: "bm",
        currency: "IDR",
        timezone: "Asia/Jakarta",
        campaigns: [campaign],
        syncedAt: new Date(),
      } as unknown as AdAccount;
    }

    it("zero behavior change by default: no agent_logic row means the real PAUSE count stays exactly ad.verdict-derived", async () => {
      const adAccount = buildPauseAdAccount(30_000, 2);
      const repository = buildFakeRepository();
      const service = buildService({ repository, connector: buildFakeConnector(adAccount) });

      await service.executeEvent(buildEvent({ eventType: "SAMANTHA_ANALYZE" }));

      expect(repository.markDone).toHaveBeenCalledWith(
        "evt-1",
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({ pause: 1, scale: 0 }),
      );
    });

    it("a real agent_logic ruleset genuinely reclassifies the digest count (PAUSE -> KEEP) when its condition matches", async () => {
      const adAccount = buildPauseAdAccount(3_000, 2); // rphChatIDR = 3_000 — low
      const repository = buildFakeRepository();
      const agentLogicService = buildFakeAgentLogicService(
        vi.fn(async (_tenantId: string, _agent: string, logicKey: string) =>
          logicKey === "verdict_classification"
            ? [
                {
                  conditions: [{ field: "rphChatIDR", operator: "lte", value: 9_000 }],
                  result: "KEEP",
                },
              ]
            : undefined,
        ),
      );
      const service = buildService({
        repository,
        connector: buildFakeConnector(adAccount),
        agentLogicService,
      });

      await service.executeEvent(buildEvent({ eventType: "SAMANTHA_ANALYZE" }));

      expect(repository.markDone).toHaveBeenCalledWith(
        "evt-1",
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({ pause: 0, scale: 0 }),
      );
    });

    it("an agent_logic rule naming a real but non-matching condition leaves the real PAUSE count unchanged (honest no-match fallback)", async () => {
      const adAccount = buildPauseAdAccount(30_000, 2); // rphChatIDR = 30_000 — high, doesn't match "<= 9000"
      const repository = buildFakeRepository();
      const agentLogicService = buildFakeAgentLogicService(
        vi.fn(async () => [
          { conditions: [{ field: "rphChatIDR", operator: "lte", value: 9_000 }], result: "KEEP" },
        ]),
      );
      const service = buildService({
        repository,
        connector: buildFakeConnector(adAccount),
        agentLogicService,
      });

      await service.executeEvent(buildEvent({ eventType: "SAMANTHA_ANALYZE" }));

      expect(repository.markDone).toHaveBeenCalledWith(
        "evt-1",
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({ pause: 1, scale: 0 }),
      );
    });

    it("a rule naming a result string outside the real Verdict enum is a real, honest no-op — never fabricates a new verdict", async () => {
      const adAccount = buildPauseAdAccount(3_000, 2);
      const repository = buildFakeRepository();
      const agentLogicService = buildFakeAgentLogicService(
        vi.fn(async () => [
          {
            conditions: [{ field: "rphChatIDR", operator: "lte", value: 9_000 }],
            result: "NOT_A_REAL_VERDICT",
          },
        ]),
      );
      const service = buildService({
        repository,
        connector: buildFakeConnector(adAccount),
        agentLogicService,
      });

      await service.executeEvent(buildEvent({ eventType: "SAMANTHA_ANALYZE" }));

      expect(repository.markDone).toHaveBeenCalledWith(
        "evt-1",
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({ pause: 1, scale: 0 }),
      );
    });

    it("resolves the tenant's real agent_logic ruleset via AgentLogicService.get with the real (tenantId, 'SAMANTHA', 'verdict_classification') args", async () => {
      const adAccount = buildPauseAdAccount(30_000, 2);
      const repository = buildFakeRepository();
      const get = vi.fn(async () => undefined);
      const agentLogicService = buildFakeAgentLogicService(get);
      const service = buildService({
        repository,
        connector: buildFakeConnector(adAccount),
        agentLogicService,
      });

      await service.executeEvent(buildEvent({ eventType: "SAMANTHA_ANALYZE" }));

      expect(get).toHaveBeenCalledWith("dss-motor", "SAMANTHA", "verdict_classification");
    });
  });

  it("KAI_REFRESH_CHECK counts REFRESH decisions from the real VerdictDecisionEngine", async () => {
    const ad = unwrap(new AdBuilder().withVerdict(Verdict.REFRESH).build());
    const adSet = unwrap(new AdSetBuilder().withAds([ad]).build());
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    const adAccount = {
      id: campaign.adSets[0]?.adAccountId,
      name: "Acc",
      businessManagerId: "bm",
      currency: "IDR",
      timezone: "Asia/Jakarta",
      campaigns: [campaign],
      syncedAt: new Date(),
    } as unknown as AdAccount;

    const repository = buildFakeRepository();
    const service = buildService({ repository, connector: buildFakeConnector(adAccount) });
    await service.executeEvent(buildEvent({ eventType: "KAI_REFRESH_CHECK" }));

    expect(repository.markDone).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({ refreshNeeded: 1 }),
    );
  });

  it("KAI_REFRESH_CHECK reports zero when no ad needs a refresh", async () => {
    const repository = buildFakeRepository();
    const service = buildService({ repository });
    await service.executeEvent(buildEvent({ eventType: "KAI_REFRESH_CHECK" }));
    expect(repository.markDone).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({ refreshNeeded: 0, summary: "Tidak ada iklan jenuh" }),
    );
  });

  describe("PROPERTY campaign-trigger wiring (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase C)", () => {
    const propertyTenants = [{ tenant_id: "dss-motor", status: "ACTIVE", vertical: "PROPERTY" }];

    function buildListing(): ListingListResponseDto["listings"][number] {
      return {
        id: "listing-1",
        title: "Rumah Baru Tanpa Campaign",
        propertyType: "RUMAH",
        listingStatus: "AKTIF",
        price: 1_000_000_000,
        branchId: "BINTARO",
        highlights: [],
        photos: [],
        inKnowledgeBase: false,
        // Old enough to be past NEW_LISTING_WINDOW_MS (48h) and unmatched by any campaign name
        // below, so this fires NO_ACTIVE_CAMPAIGN, not NEW_LISTING_WITHOUT_CAMPAIGN.
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };
    }

    it("AUTOMOTIVE tenants are never checked (no-op, AreaPriority/Branch targeting unchanged)", async () => {
      const repository = buildFakeRepository();
      const listingsService = buildFakeListingsService([buildListing()]);
      const service = buildService({
        repository,
        listingsService,
        tenants: buildFakeTenantRepository([
          { tenant_id: "dss-motor", status: "ACTIVE", vertical: "AUTOMOTIVE" },
        ]),
      });
      await service.executeEvent(buildEvent({ eventType: "SAMANTHA_ANALYZE" }));

      expect(listingsService.list).not.toHaveBeenCalled();
      expect(repository.markDone).toHaveBeenCalledWith(
        "evt-1",
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({
          propertyCampaignTriggersChecked: 0,
          propertyCampaignTriggersFired: 0,
        }),
      );
    });

    it("a real trigger calls CampaignsService.createPropertyCampaign with the real expected listingId, no dailyBudgetIDR override", async () => {
      const repository = buildFakeRepository();
      const listingsService = buildFakeListingsService([buildListing()]);
      const activityLogger = buildFakeActivityLogger();
      const campaignsService = buildFakeCampaignsService();
      const service = buildService({
        repository,
        listingsService,
        activityLogger,
        campaignsService,
        tenants: buildFakeTenantRepository(propertyTenants),
      });

      await service.executeEvent(buildEvent({ eventType: "SAMANTHA_ANALYZE" }));

      expect(campaignsService.createPropertyCampaign).toHaveBeenCalledWith(
        "dss-motor",
        { listingId: "listing-1" },
        expect.any(String),
      );
    });

    it("AAOS Self-Improving (Phase SI-1): resolves pause_cpl_multiplier via AgentConfigService.get with the real (tenantId, 'SAMANTHA', 'pause_cpl_multiplier', HIGH_CPL_MULTIPLIER) args, and a real PROPERTY trigger still fires byte-identically when no override row exists (zero behavior change)", async () => {
      const repository = buildFakeRepository();
      const listingsService = buildFakeListingsService([buildListing()]);
      const campaignsService = buildFakeCampaignsService();
      const get = vi.fn(async (_t: string, _a: string, _k: string, fallback: number) => fallback);
      const agentConfigService = buildFakeAgentConfigService(get);
      const service = buildService({
        repository,
        listingsService,
        campaignsService,
        agentConfigService,
        tenants: buildFakeTenantRepository(propertyTenants),
      });

      await service.executeEvent(buildEvent({ eventType: "SAMANTHA_ANALYZE" }));

      expect(get).toHaveBeenCalledWith("dss-motor", "SAMANTHA", "pause_cpl_multiplier", 1.5);
      expect(campaignsService.createPropertyCampaign).toHaveBeenCalledWith(
        "dss-motor",
        { listingId: "listing-1" },
        expect.any(String),
      );
      expect(repository.markDone).toHaveBeenCalledWith(
        "evt-1",
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({
          propertyCampaignTriggersChecked: 1,
          propertyCampaignTriggersFired: 1,
        }),
      );
    });

    it("DEV mode (createPropertyCampaign's own real gate, not a second one here) records a SIMULATED activity via ActivityLogger", async () => {
      const repository = buildFakeRepository();
      const listingsService = buildFakeListingsService([buildListing()]);
      const modeGuard = buildFakeModeGuardService("DEV");
      const activityLogger = buildFakeActivityLogger();
      const campaignsService = buildFakeCampaignsService(async () => ({
        simulated: true,
        resolvedCities: ["Jakarta"],
        note: "DEV mode — real Meta geo-search and campaign creation were not performed.",
      }));
      const service = buildService({
        repository,
        listingsService,
        modeGuard,
        activityLogger,
        campaignsService,
        tenants: buildFakeTenantRepository(propertyTenants),
      });

      await service.executeEvent(buildEvent({ eventType: "SAMANTHA_ANALYZE" }));

      // `resolveMode` here only TAGS this method's own `agent_activities` row — the real DEV/LIVE
      // branch is decided exactly once, inside `createPropertyCampaign` (not re-gated here).
      expect(modeGuard.resolveMode).toHaveBeenCalledWith("dss-motor");
      expect(activityLogger.start).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "dss-motor",
          agent: "SAMANTHA",
          actionType: "CAMPAIGN_TRIGGER_RECOMMENDATION",
          mode: "DEV",
        }),
      );
      expect(activityLogger.complete).toHaveBeenCalledWith(
        "activity-1",
        expect.objectContaining({
          status: "SIMULATED",
          devPreview: expect.objectContaining({ simulated: true }),
        }),
      );
      expect(repository.markDone).toHaveBeenCalledWith(
        "evt-1",
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({
          propertyCampaignTriggersChecked: 1,
          propertyCampaignTriggersFired: 1,
        }),
      );
    });

    it("LIVE mode really calls CampaignsService.createPropertyCampaign and records a SUCCESS activity with its real output", async () => {
      const repository = buildFakeRepository();
      const listingsService = buildFakeListingsService([buildListing()]);
      const modeGuard = buildFakeModeGuardService("LIVE");
      const activityLogger = buildFakeActivityLogger();
      const campaignsService = buildFakeCampaignsService(async () => ({
        simulated: false,
        resolvedCities: ["Jakarta"],
        campaignId: "campaign-1",
        adSetId: "adset-1",
      }));
      const service = buildService({
        repository,
        listingsService,
        modeGuard,
        activityLogger,
        campaignsService,
        tenants: buildFakeTenantRepository(propertyTenants),
      });

      await service.executeEvent(buildEvent({ eventType: "SAMANTHA_ANALYZE" }));

      expect(campaignsService.createPropertyCampaign).toHaveBeenCalledWith(
        "dss-motor",
        { listingId: "listing-1" },
        expect.any(String),
      );
      expect(activityLogger.start).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "LIVE", actionType: "CAMPAIGN_TRIGGER_RECOMMENDATION" }),
      );
      expect(activityLogger.complete).toHaveBeenCalledWith(
        "activity-1",
        expect.objectContaining({
          status: "SUCCESS",
          output: expect.objectContaining({ simulated: false, campaignId: "campaign-1" }),
        }),
      );
    });

    it("FULL_CONTROL operating_mode (AAOS-OPERATING-MODE-APPROVAL-GATE zero-regression) calls CampaignsService.createPropertyCampaign directly and never touches PendingActionsService — byte-for-byte the same real behavior as before this gate existed", async () => {
      const repository = buildFakeRepository();
      const listingsService = buildFakeListingsService([buildListing()]);
      const activityLogger = buildFakeActivityLogger();
      const campaignsService = buildFakeCampaignsService();
      const pendingActions = buildFakePendingActionsService();
      const service = buildService({
        repository,
        listingsService,
        activityLogger,
        campaignsService,
        pendingActions,
        tenants: buildFakeTenantRepository([
          {
            tenant_id: "dss-motor",
            status: "ACTIVE",
            vertical: "PROPERTY",
            operating_mode: "FULL_CONTROL",
          },
        ]),
      });

      await service.executeEvent(buildEvent({ eventType: "SAMANTHA_ANALYZE" }));

      expect(campaignsService.createPropertyCampaign).toHaveBeenCalledWith(
        "dss-motor",
        { listingId: "listing-1" },
        expect.any(String),
      );
      expect(pendingActions.enqueue).not.toHaveBeenCalled();
      expect(activityLogger.complete).toHaveBeenCalledWith(
        "activity-1",
        expect.objectContaining({ status: "SUCCESS" }),
      );
      expect(activityLogger.escalate).not.toHaveBeenCalled();
    });

    it("a tenant row with no operating_mode value at all (pre-migration fixture) falls back to FULL_CONTROL — same zero-regression guarantee", async () => {
      const repository = buildFakeRepository();
      const listingsService = buildFakeListingsService([buildListing()]);
      const campaignsService = buildFakeCampaignsService();
      const pendingActions = buildFakePendingActionsService();
      const service = buildService({
        repository,
        listingsService,
        campaignsService,
        pendingActions,
        // No `operating_mode` field at all — exercises the real `tenant.operating_mode ?? "FULL_CONTROL"` fallback.
        tenants: buildFakeTenantRepository(propertyTenants),
      });

      await service.executeEvent(buildEvent({ eventType: "SAMANTHA_ANALYZE" }));

      expect(campaignsService.createPropertyCampaign).toHaveBeenCalledWith(
        "dss-motor",
        { listingId: "listing-1" },
        expect.any(String),
      );
      expect(pendingActions.enqueue).not.toHaveBeenCalled();
    });

    it("APPROVAL operating_mode writes a real pending_agent_actions row via PendingActionsService.enqueue instead of calling CampaignsService.createPropertyCampaign — no real campaign is created", async () => {
      const repository = buildFakeRepository();
      const listingsService = buildFakeListingsService([buildListing()]);
      const activityLogger = buildFakeActivityLogger();
      const campaignsService = buildFakeCampaignsService();
      const pendingActions = buildFakePendingActionsService();
      const service = buildService({
        repository,
        listingsService,
        activityLogger,
        campaignsService,
        pendingActions,
        tenants: buildFakeTenantRepository([
          {
            tenant_id: "dss-motor",
            status: "ACTIVE",
            vertical: "PROPERTY",
            operating_mode: "APPROVAL",
          },
        ]),
      });

      await service.executeEvent(buildEvent({ eventType: "SAMANTHA_ANALYZE" }));

      // The real gate: no direct campaign-creation call, no real Meta call.
      expect(campaignsService.createPropertyCampaign).not.toHaveBeenCalled();
      expect(pendingActions.enqueue).toHaveBeenCalledWith({
        tenantId: "dss-motor",
        agent: "SAMANTHA",
        actionType: "CREATE_PROPERTY_CAMPAIGN",
        payload: { listingId: "listing-1" },
      });
      // Informational only (design doc Finding 4 / "log ≠ gate") — the activity row is escalated
      // (NEEDS_HUMAN), never marked SUCCESS/SIMULATED, since nothing was actually executed.
      expect(activityLogger.escalate).toHaveBeenCalledWith(
        "activity-1",
        expect.objectContaining({
          output: expect.objectContaining({
            status: "PENDING_APPROVAL",
            pendingActionId: "pending-1",
            listingId: "listing-1",
          }),
        }),
      );
      expect(activityLogger.complete).not.toHaveBeenCalled();
      expect(repository.markDone).toHaveBeenCalledWith(
        "evt-1",
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({
          propertyCampaignTriggersChecked: 1,
          propertyCampaignTriggersFired: 1,
        }),
      );
    });

    it("APPROVAL operating_mode: a pendingActions.enqueue failure fails its own activity row and does not abort the rest of the check (multi-listing, same best-effort discipline as FULL_CONTROL)", async () => {
      const repository = buildFakeRepository();
      const failingListing = buildListing();
      const okListing = { ...buildListing(), id: "listing-2", title: "Rumah Kedua Tanpa Campaign" };
      const listingsService = buildFakeListingsService([failingListing, okListing]);
      const activityLogger = buildFakeActivityLogger();
      const campaignsService = buildFakeCampaignsService();
      const enqueue = vi
        .fn()
        .mockRejectedValueOnce(new Error("insert failed"))
        .mockResolvedValueOnce("pending-2");
      const pendingActions = buildFakePendingActionsService(enqueue);
      const service = buildService({
        repository,
        listingsService,
        activityLogger,
        campaignsService,
        pendingActions,
        tenants: buildFakeTenantRepository([
          {
            tenant_id: "dss-motor",
            status: "ACTIVE",
            vertical: "PROPERTY",
            operating_mode: "APPROVAL",
          },
        ]),
      });

      await service.executeEvent(buildEvent({ eventType: "SAMANTHA_ANALYZE" }));

      expect(campaignsService.createPropertyCampaign).not.toHaveBeenCalled();
      expect(enqueue).toHaveBeenCalledTimes(2);
      expect(activityLogger.fail).toHaveBeenCalledTimes(1);
      expect(repository.markDone).toHaveBeenCalledWith(
        "evt-1",
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({
          propertyCampaignTriggersChecked: 2,
          propertyCampaignTriggersFired: 1,
        }),
      );
      expect(repository.markFailed).not.toHaveBeenCalled();
    });

    it("a createPropertyCampaign failure for one listing is logged and does not abort the rest of the check (multi-listing)", async () => {
      const repository = buildFakeRepository();
      const failingListing = buildListing();
      const okListing = {
        ...buildListing(),
        id: "listing-2",
        title: "Rumah Kedua Tanpa Campaign",
      };
      const listingsService = buildFakeListingsService([failingListing, okListing]);
      const activityLogger = buildFakeActivityLogger();
      const createPropertyCampaign = vi
        .fn()
        .mockRejectedValueOnce(new Error("Meta API error: every city failed to resolve"))
        .mockResolvedValueOnce({
          simulated: false,
          resolvedCities: ["Jakarta"],
          campaignId: "campaign-2",
          adSetId: "adset-2",
        });
      const campaignsService = { createPropertyCampaign } as unknown as CampaignsService;
      const service = buildService({
        repository,
        listingsService,
        activityLogger,
        campaignsService,
        tenants: buildFakeTenantRepository(propertyTenants),
      });

      await service.executeEvent(buildEvent({ eventType: "SAMANTHA_ANALYZE" }));

      // Both listings were attempted despite the first one's real failure.
      expect(createPropertyCampaign).toHaveBeenCalledTimes(2);
      expect(createPropertyCampaign).toHaveBeenNthCalledWith(
        1,
        "dss-motor",
        { listingId: "listing-1" },
        expect.any(String),
      );
      expect(createPropertyCampaign).toHaveBeenNthCalledWith(
        2,
        "dss-motor",
        { listingId: "listing-2" },
        expect.any(String),
      );
      // The failed listing's own activity row is marked failed (real error surfaced, not swallowed).
      expect(activityLogger.fail).toHaveBeenCalledTimes(1);
      // The whole handler still completes successfully (does not abort/mark the event FAILED) —
      // only the ONE listing that actually failed is excluded from `triggered`.
      expect(repository.markDone).toHaveBeenCalledWith(
        "evt-1",
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({
          propertyCampaignTriggersChecked: 2,
          propertyCampaignTriggersFired: 1,
        }),
      );
      expect(repository.markFailed).not.toHaveBeenCalled();
    });

    it("no trigger fires (and nothing is logged) when the listing already has a matching real ACTIVE campaign with healthy signals", async () => {
      const ad = unwrap(new AdBuilder().build());
      const adSet = unwrap(new AdSetBuilder().withAds([ad]).build());
      const campaign = unwrap(
        new CampaignBuilder()
          .withName("Rumah Baru Tanpa Campaign - Product")
          .withAdSets([adSet])
          .build(),
      );
      const adAccount = {
        id: campaign.adSets[0]?.adAccountId,
        name: "Acc",
        businessManagerId: "bm",
        currency: "IDR",
        timezone: "Asia/Jakarta",
        campaigns: [campaign],
        syncedAt: new Date(),
      } as unknown as AdAccount;

      const repository = buildFakeRepository();
      const listingsService = buildFakeListingsService([buildListing()]);
      const activityLogger = buildFakeActivityLogger();
      const service = buildService({
        repository,
        listingsService,
        activityLogger,
        connector: buildFakeConnector(adAccount),
        tenants: buildFakeTenantRepository(propertyTenants),
      });

      await service.executeEvent(buildEvent({ eventType: "KAI_REFRESH_CHECK" }));

      expect(activityLogger.start).not.toHaveBeenCalled();
      expect(repository.markDone).toHaveBeenCalledWith(
        "evt-1",
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({
          propertyCampaignTriggersChecked: 1,
          propertyCampaignTriggersFired: 0,
        }),
      );
    });
  });

  it("DAILY_DIGEST builds a real digest from the current Objective and pulled AdAccount", async () => {
    const repository = buildFakeRepository();
    const service = buildService({ repository });
    await service.executeEvent(buildEvent({ eventType: "DAILY_DIGEST" }));

    expect(repository.markDone).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({ currentHotLeads: 42, targetHotLeads: 100 }),
    );
  });

  it("DAILY_DIGEST extends its text with recently-completed A/B tests and the real Lookalike sync milestone", async () => {
    const repository = buildFakeRepository();
    const abTestingService = buildFakeAbTestingService(undefined, [
      { name: "ABT-003 Xpander Cinere", completedAt: new Date().toISOString(), improvementPct: 28 },
    ]);
    const lookalikeServiceFake = {
      runLookalikeSync: vi.fn(async () => ({ summary: "ok", newlySynced: 0, totalSynced: 0 })),
      getStatus: vi.fn(async () => ({
        totalHotLeads: 47,
        syncedToMetaAudience: 38,
        minRequiredForLookalike: 100,
        progressPercentage: 47,
        lookalikeEligible: false,
      })),
    } as unknown as LookalikeService;
    const service = buildService({
      repository,
      abTestingService,
      lookalikeService: lookalikeServiceFake,
    });
    await service.executeEvent(buildEvent({ eventType: "DAILY_DIGEST" }));

    expect(repository.markDone).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({
        text: expect.stringContaining("ABT-003 Xpander Cinere selesai (28% lebih efisien)"),
      }),
    );
    expect(repository.markDone).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({
        text: expect.stringContaining("47/100 hot leads terkumpul"),
      }),
    );
  });

  it("DAILY_DIGEST fails honestly when no Objective exists for the tenant", async () => {
    const repository = buildFakeRepository();
    const service = buildService({
      repository,
      objectiveEngine: buildFakeObjectiveEngine(false),
    });
    await service.executeEvent(buildEvent({ eventType: "DAILY_DIGEST" }));

    expect(repository.markFailed).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.stringContaining("Belum ada Objective"),
    );
  });

  it("RECYCLING_RUN delegates to RecyclingService.runRecyclingRun and marks DONE with its real summary", async () => {
    const repository = buildFakeRepository();
    const recyclingService = buildFakeRecyclingService({
      summary: "3 broadcast terkirim",
      attempted: 3,
      sent: 3,
      failed: 0,
    });
    const service = buildService({ repository, recyclingService });
    await service.executeEvent(buildEvent({ eventType: "RECYCLING_RUN" }));

    expect(recyclingService.runRecyclingRun).toHaveBeenCalled();
    expect(repository.markDone).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({ summary: "3 broadcast terkirim", sent: 3 }),
    );
  });

  it("RECYCLING_RUN honors Auto Mode OFF with an honest no-op summary", async () => {
    const repository = buildFakeRepository();
    const recyclingService = buildFakeRecyclingService({
      summary: "Auto Mode OFF, tidak ada broadcast dikirim",
      attempted: 0,
      sent: 0,
      failed: 0,
    });
    const service = buildService({ repository, recyclingService });
    await service.executeEvent(buildEvent({ eventType: "RECYCLING_RUN" }));

    expect(repository.markDone).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({ summary: "Auto Mode OFF, tidak ada broadcast dikirim" }),
    );
  });

  it("AB_TEST_CHECK delegates to AbTestingService.runAbTestCheck and marks DONE with its real summary", async () => {
    const repository = buildFakeRepository();
    const abTestingService = buildFakeAbTestingService({
      summary: "1 test di-launch · 1 winner ditemukan",
      launched: 1,
      winnersDeclared: 1,
    });
    const service = buildService({ repository, abTestingService });
    await service.executeEvent(buildEvent({ eventType: "AB_TEST_CHECK" }));

    expect(abTestingService.runAbTestCheck).toHaveBeenCalled();
    expect(repository.markDone).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({ summary: "1 test di-launch · 1 winner ditemukan", launched: 1 }),
    );
  });

  it("LOOKALIKE_SYNC delegates to LookalikeService.runLookalikeSync and marks DONE with its real summary", async () => {
    const repository = buildFakeRepository();
    const lookalikeService = buildFakeLookalikeService({
      summary: "5 hot leads baru disync ke Meta Custom Audience",
      newlySynced: 5,
      totalSynced: 42,
    });
    const service = buildService({ repository, lookalikeService });
    await service.executeEvent(buildEvent({ eventType: "LOOKALIKE_SYNC" }));

    expect(lookalikeService.runLookalikeSync).toHaveBeenCalled();
    expect(repository.markDone).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({
        summary: "5 hot leads baru disync ke Meta Custom Audience",
        newlySynced: 5,
      }),
    );
  });

  it("SAMANTHA_INTELLIGENCE_REFRESH delegates to IntelligenceService.refresh and marks DONE with its real summary", async () => {
    const repository = buildFakeRepository();
    const intelligenceService = buildFakeIntelligenceService({
      id: "sig-1",
      branchId: null,
      seasonal: { isSpecialPeriod: false },
      trends: { available: false },
      competitor: { available: false },
      inventory: { available: false },
      leadProfile: { totalLeads: 0 },
      closing: { totalEvents: 0 },
      campaignStrategy: { available: true, summary: "Brand 30% + Product 70%" },
      digestText: "digest",
      generatedAt: "2026-08-19T06:00:00.000Z",
    } as unknown as CalendarEventResult);
    const service = buildService({ repository, intelligenceService });
    await service.executeEvent(buildEvent({ eventType: "SAMANTHA_INTELLIGENCE_REFRESH" }));

    expect(intelligenceService.refresh).toHaveBeenCalled();
    expect(repository.markDone).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({ summary: "Brand 30% + Product 70%" }),
    );
  });

  it("SAMANTHA_INTELLIGENCE_REFRESH reports an honest summary when the AI strategy is unavailable", async () => {
    const repository = buildFakeRepository();
    const service = buildService({ repository });
    await service.executeEvent(buildEvent({ eventType: "SAMANTHA_INTELLIGENCE_REFRESH" }));

    expect(repository.markDone).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({ summary: "AI campaign strategy tidak tersedia" }),
    );
  });

  it("MARKET_INTELLIGENCE_REFRESH delegates to MarketIntelligenceService.refresh and marks DONE with its real digest summary", async () => {
    const repository = buildFakeRepository();
    const marketIntelligenceService = buildFakeMarketIntelligenceService({
      id: "mkt-1",
      vertical: "PROPERTY",
      searchTrend: { available: true, keywords: [], reasoning: "x" },
      competitorAngleTrend: { available: false, reason: "META_APP_ID belum dikonfigurasi." },
      kprRate: { available: false, reason: "belum dikonfigurasi" },
      seasonality: { available: true, status: "musim ramai", note: "Mendekati THR" },
      digestText: "📊 Sinyal Pasar\n📅 Musiman: Mendekati THR",
      generatedAt: "2026-08-19T07:00:00.000Z",
    } as unknown as CalendarEventResult);
    const service = buildService({ repository, marketIntelligenceService });
    await service.executeEvent(buildEvent({ eventType: "MARKET_INTELLIGENCE_REFRESH" }));

    expect(marketIntelligenceService.refresh).toHaveBeenCalled();
    expect(repository.markDone).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({ summary: "📊 Sinyal Pasar\n📅 Musiman: Mendekati THR" }),
    );
  });

  it("DAILY_DIGEST extends its text with the latest Samantha Intelligence run's real campaign-strategy summary", async () => {
    const repository = buildFakeRepository();
    const intelligenceService = {
      refresh: vi.fn(),
      getLatest: vi.fn(async () => ({
        id: "sig-1",
        branchId: null,
        seasonal: { isSpecialPeriod: false },
        trends: { available: false },
        competitor: { available: false },
        inventory: { available: false },
        leadProfile: { totalLeads: 0 },
        closing: { totalEvents: 0 },
        campaignStrategy: { available: true, summary: "Brand 30% TRUST + Product 70% DP_RINGAN" },
        digestText: "digest",
        generatedAt: "2026-08-19T06:00:00.000Z",
      })),
    } as unknown as IntelligenceService;
    const service = buildService({ repository, intelligenceService });
    await service.executeEvent(buildEvent({ eventType: "DAILY_DIGEST" }));

    expect(repository.markDone).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({
        text: expect.stringContaining("Brand 30% TRUST + Product 70% DP_RINGAN"),
      }),
    );
  });

  it("DAILY_DIGEST omits the Samantha Intelligence section when no run has ever completed", async () => {
    const repository = buildFakeRepository();
    const service = buildService({ repository });
    await service.executeEvent(buildEvent({ eventType: "DAILY_DIGEST" }));

    expect(repository.markDone).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({
        text: expect.not.stringContaining("🧠 Samantha Intelligence"),
      }),
    );
  });

  it("schedules the next occurrence for an INTERVAL_HOURS event using recurrenceIntervalHours", async () => {
    const repository = buildFakeRepository();
    const service = buildService({ repository });
    await service.executeEvent(
      buildEvent({
        eventType: "AB_TEST_CHECK",
        recurrence: "INTERVAL_HOURS",
        recurrenceIntervalHours: 6,
      }),
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        parentEventId: "evt-1",
        recurrence: "INTERVAL_HOURS",
        recurrenceIntervalHours: 6,
      }),
    );
  });

  it("schedules the next occurrence for a recurring event after a successful run", async () => {
    const repository = buildFakeRepository();
    const service = buildService({ repository });
    await service.executeEvent(buildEvent({ eventType: "SCRAPER_RUN", recurrence: "DAILY" }));
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ parentEventId: "evt-1", recurrence: "DAILY" }),
    );
  });

  it("does not schedule a next occurrence for a ONCE event", async () => {
    const repository = buildFakeRepository();
    const service = buildService({ repository });
    await service.executeEvent(buildEvent({ eventType: "SCRAPER_RUN", recurrence: "ONCE" }));
    expect(repository.create).not.toHaveBeenCalled();
  });
});

describe("SchedulerService.runSamanthaAnalyze — AAOS-AI-JUDGE-SELF-IMPROVING Phase J1", () => {
  it("records a real agent_runs row keyed by the real calendar_events id, with a real minimal context, after a successful analyze", async () => {
    const repository = buildFakeRepository();
    const { client, agentRunsService } = buildRealAgentRunsService();
    const llmService = buildFakeLlmService();
    const service = buildService({ repository, agentRunsService, llmService });

    await service.executeEvent(buildEvent({ id: "evt-analyze-1", eventType: "SAMANTHA_ANALYZE" }));

    const rows = client.rows("agent_runs");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tenant_id: "dss-motor",
      agent: "SAMANTHA",
      run_ref: "evt-analyze-1",
      context: expect.objectContaining({
        campaigns: expect.any(Number),
        totalAds: expect.any(Number),
        pause: expect.any(Number),
        scale: expect.any(Number),
        aiAvailable: true,
      }),
    });
  });

  it("still records a real agent_runs row (aiAvailable: false) when the LLM is honestly unavailable", async () => {
    const repository = buildFakeRepository();
    const { client, agentRunsService } = buildRealAgentRunsService();
    const llmService = {
      analyze: vi.fn(async () => ({ available: false })),
    } as unknown as LlmService;
    const service = buildService({ repository, agentRunsService, llmService });

    await service.executeEvent(buildEvent({ id: "evt-analyze-2", eventType: "SAMANTHA_ANALYZE" }));

    const rows = client.rows("agent_runs");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      run_ref: "evt-analyze-2",
      context: expect.objectContaining({ aiAvailable: false }),
    });
  });

  it("a real agent_runs recording failure does not abort the real SAMANTHA_ANALYZE run — it still completes and marks the event DONE", async () => {
    const repository = buildFakeRepository();
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("agent_runs", "simulated DB outage");
    const { agentRunsService } = buildRealAgentRunsService(client);
    const service = buildService({ repository, agentRunsService });

    await service.executeEvent(buildEvent({ id: "evt-analyze-3", eventType: "SAMANTHA_ANALYZE" }));

    expect(client.rows("agent_runs")).toHaveLength(0);
    expect(repository.markFailed).not.toHaveBeenCalled();
    expect(repository.markDone).toHaveBeenCalledWith(
      "evt-analyze-3",
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({ aiAvailable: true }),
    );
  });
});

describe("SchedulerService.runSamanthaAnalyze — AAOS-AI-JUDGE-SELF-IMPROVING Phase J2 (real judging wiring, detached)", () => {
  it("calls AiJudgeService.judgeRun with the real tenantId and the real new agent_runs id, detached (executeEvent's own markDone already ran before judgeRun's promise settles)", async () => {
    const repository = buildFakeRepository();
    const { client, agentRunsService } = buildRealAgentRunsService();
    const llmService = buildFakeLlmService();
    let resolveJudge: (() => void) | undefined;
    const judgeStarted = new Promise<void>((resolve) => {
      resolveJudge = resolve;
    });
    let judgeRunSettled = false;
    const aiJudgeService = buildFakeAiJudgeService(async () => {
      resolveJudge?.();
      await new Promise((resolve) => setTimeout(resolve, 5));
      judgeRunSettled = true;
    });
    const service = buildService({ repository, agentRunsService, llmService, aiJudgeService });

    await service.executeEvent(buildEvent({ id: "evt-analyze-4", eventType: "SAMANTHA_ANALYZE" }));

    // executeEvent already resolved (markDone was already called) — real, honest proof this call
    // is detached, not awaited.
    expect(repository.markDone).toHaveBeenCalled();
    expect(judgeRunSettled).toBe(false);

    await judgeStarted;
    const runId = client.rows("agent_runs")[0]?.["id"];
    expect(aiJudgeService.judgeRun).toHaveBeenCalledWith("dss-motor", runId);
  });

  it("a judgeRun rejection never aborts the real SAMANTHA_ANALYZE run — it still completes and marks the event DONE (best-effort, same discipline as AgentRunsService.record)", async () => {
    const repository = buildFakeRepository();
    const { agentRunsService } = buildRealAgentRunsService();
    const aiJudgeService = buildFakeAiJudgeService(async () => {
      throw new Error("simulated judge failure");
    });
    const service = buildService({ repository, agentRunsService, aiJudgeService });

    await service.executeEvent(buildEvent({ id: "evt-analyze-5", eventType: "SAMANTHA_ANALYZE" }));

    expect(repository.markFailed).not.toHaveBeenCalled();
    expect(repository.markDone).toHaveBeenCalled();
    // Let the detached rejection's .catch() run — an unhandled rejection here would fail the test run.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

describe("SchedulerService.checkAndRunDueEvents", () => {
  it("runs every due PENDING event returned by the repository", async () => {
    const repository = buildFakeRepository({
      listDuePending: vi.fn(async () => [buildEvent({ id: "due-1" })]),
    } as Partial<CalendarEventRepository>);
    const service = buildService({ repository });
    await service.checkAndRunDueEvents();
    expect(repository.markRunning).toHaveBeenCalledWith("due-1", expect.any(String));
  });

  it("loops over every real, non-SUSPENDED tenant and never cross-mixes their own due events (cross-tenant isolation)", async () => {
    const tenants = buildFakeTenantRepository([
      { tenant_id: "dss-motor", status: "ACTIVE" },
      { tenant_id: "tenant-b", status: "TRIAL" },
    ]);
    const listDuePending = vi.fn(async (tenantId: string) => [
      buildEvent({ id: `evt-${tenantId}`, tenantId }),
    ]);
    const repository = buildFakeRepository({
      listDuePending,
    } as Partial<CalendarEventRepository>);
    const service = buildService({ repository, tenants });
    await service.checkAndRunDueEvents();

    // Each tenant's OWN row is fetched, via its own real tenant id — never one static default.
    expect(listDuePending).toHaveBeenCalledWith(
      "dss-motor",
      expect.any(String),
      expect.any(String),
    );
    expect(listDuePending).toHaveBeenCalledWith("tenant-b", expect.any(String), expect.any(String));
    // Each dispatched event carries its OWN tenantId, never the other tenant's.
    expect(repository.markRunning).toHaveBeenCalledWith("evt-dss-motor", expect.any(String));
    expect(repository.markRunning).toHaveBeenCalledWith("evt-tenant-b", expect.any(String));
  });

  it("skips a SUSPENDED tenant entirely — its due events never run", async () => {
    const tenants = buildFakeTenantRepository([
      { tenant_id: "dss-motor", status: "ACTIVE" },
      { tenant_id: "suspended-co", status: "SUSPENDED" },
    ]);
    const listDuePending = vi.fn(async (tenantId: string) => [
      buildEvent({ id: `evt-${tenantId}`, tenantId }),
    ]);
    const repository = buildFakeRepository({
      listDuePending,
    } as Partial<CalendarEventRepository>);
    const service = buildService({ repository, tenants });
    await service.checkAndRunDueEvents();

    expect(listDuePending).toHaveBeenCalledWith(
      "dss-motor",
      expect.any(String),
      expect.any(String),
    );
    expect(listDuePending).not.toHaveBeenCalledWith(
      "suspended-co",
      expect.any(String),
      expect.any(String),
    );
    expect(repository.markRunning).not.toHaveBeenCalledWith("evt-suspended-co", expect.any(String));
  });
});

describe("SchedulerService CRUD", () => {
  it("createEvent persists with createdBy=manager and the caller's real tenantId", async () => {
    const repository = buildFakeRepository();
    const service = buildService({ repository });
    await service.createEvent("dss-motor", {
      eventType: "SCRAPER_RUN",
      title: "Scrape",
      scheduledAt: "2026-08-19T06:00:00+07:00",
      recurrence: "ONCE",
    });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        createdBy: "manager",
        eventType: "SCRAPER_RUN",
        tenantId: "dss-motor",
      }),
    );
  });

  it("listEvents passes the caller's real tenantId through to the repository", async () => {
    const repository = buildFakeRepository();
    const service = buildService({ repository });
    await service.listEvents("dss-motor", { range: "this_week" });
    expect(repository.listByRange).toHaveBeenCalledWith(
      "dss-motor",
      expect.any(String),
      expect.any(String),
    );
  });

  it("updateEvent patches an existing event owned by the caller's tenant", async () => {
    const repository = buildFakeRepository();
    const service = buildService({ repository });
    await service.updateEvent("dss-motor", "evt-1", { title: "Baru" });
    expect(repository.update).toHaveBeenCalledWith("evt-1", { title: "Baru" });
  });

  it("removeEvent deletes an existing event owned by the caller's tenant", async () => {
    const repository = buildFakeRepository();
    const service = buildService({ repository });
    await service.removeEvent("dss-motor", "evt-1");
    expect(repository.delete).toHaveBeenCalledWith("evt-1");
  });

  it("runNow executes the event immediately", async () => {
    const repository = buildFakeRepository();
    const service = buildService({ repository });
    await service.runNow("dss-motor", "evt-1");
    expect(repository.markRunning).toHaveBeenCalled();
  });

  it("skip marks SKIPPED and schedules the next occurrence for a recurring event", async () => {
    const repository = buildFakeRepository({
      findById: vi.fn(async () => buildEvent({ recurrence: "DAILY" })),
    } as Partial<CalendarEventRepository>);
    const service = buildService({ repository });
    await service.skip("dss-motor", "evt-1");
    expect(repository.markSkipped).toHaveBeenCalledWith("evt-1");
    expect(repository.create).toHaveBeenCalled();
  });

  it("skip does not schedule a next occurrence for a ONCE event", async () => {
    const repository = buildFakeRepository({
      findById: vi.fn(async () => buildEvent({ recurrence: "ONCE" })),
    } as Partial<CalendarEventRepository>);
    const service = buildService({ repository });
    await service.skip("dss-motor", "evt-1");
    expect(repository.create).not.toHaveBeenCalled();
  });

  // Real ownership-check test (design doc "SIZING" section): tenant A's session calling
  // runNow/skip on tenant B's real event id must get a NotFoundError, never tenant B's data.
  it("runNow throws NotFoundError (not tenant B's data) when the event belongs to a different tenant", async () => {
    const repository = buildFakeRepository({
      findById: vi.fn(async () => buildEvent({ id: "evt-1", tenantId: "tenant-b" })),
    } as Partial<CalendarEventRepository>);
    const service = buildService({ repository });
    await expect(service.runNow("dss-motor", "evt-1")).rejects.toThrow(NotFoundError);
    expect(repository.markRunning).not.toHaveBeenCalled();
  });

  it("skip throws NotFoundError (not tenant B's data) when the event belongs to a different tenant", async () => {
    const repository = buildFakeRepository({
      findById: vi.fn(async () => buildEvent({ id: "evt-1", tenantId: "tenant-b" })),
    } as Partial<CalendarEventRepository>);
    const service = buildService({ repository });
    await expect(service.skip("dss-motor", "evt-1")).rejects.toThrow(NotFoundError);
    expect(repository.markSkipped).not.toHaveBeenCalled();
  });

  it("updateEvent throws NotFoundError when the event belongs to a different tenant", async () => {
    const repository = buildFakeRepository({
      findById: vi.fn(async () => buildEvent({ id: "evt-1", tenantId: "tenant-b" })),
    } as Partial<CalendarEventRepository>);
    const service = buildService({ repository });
    await expect(service.updateEvent("dss-motor", "evt-1", { title: "Hijack" })).rejects.toThrow(
      NotFoundError,
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("removeEvent throws NotFoundError when the event belongs to a different tenant", async () => {
    const repository = buildFakeRepository({
      findById: vi.fn(async () => buildEvent({ id: "evt-1", tenantId: "tenant-b" })),
    } as Partial<CalendarEventRepository>);
    const service = buildService({ repository });
    await expect(service.removeEvent("dss-motor", "evt-1")).rejects.toThrow(NotFoundError);
    expect(repository.delete).not.toHaveBeenCalled();
  });
});

describe("nextOccurrence", () => {
  it("returns undefined for ONCE", () => {
    expect(nextOccurrence(buildEvent({ recurrence: "ONCE" }))).toBeUndefined();
  });

  it("adds 1 day for DAILY", () => {
    const next = nextOccurrence(
      buildEvent({ recurrence: "DAILY", scheduledAt: "2026-08-19T06:00:00.000Z" }),
    );
    expect(next?.toISOString()).toBe("2026-08-20T06:00:00.000Z");
  });

  it("adds 1 month for MONTHLY", () => {
    const next = nextOccurrence(
      buildEvent({ recurrence: "MONTHLY", scheduledAt: "2026-08-01T08:00:00.000Z" }),
    );
    expect(next?.toISOString()).toBe("2026-09-01T08:00:00.000Z");
  });

  it("WEEKLY advances to the next matching ISO weekday", () => {
    // 2026-08-18 is a Tuesday (isoWeekday 2); recurrenceDays [1] (Senin) -> next Monday.
    const next = nextOccurrence(
      buildEvent({
        recurrence: "WEEKLY",
        recurrenceDays: [1],
        scheduledAt: "2026-08-18T08:00:00.000Z",
      }),
    );
    expect(next?.toISOString()).toBe("2026-08-24T08:00:00.000Z");
  });

  it("WEEKLY with no recurrenceDays returns undefined", () => {
    expect(
      nextOccurrence(buildEvent({ recurrence: "WEEKLY", scheduledAt: "2026-08-18T08:00:00.000Z" })),
    ).toBeUndefined();
  });

  it("INTERVAL_HOURS adds recurrenceIntervalHours hours", () => {
    const next = nextOccurrence(
      buildEvent({
        recurrence: "INTERVAL_HOURS",
        recurrenceIntervalHours: 6,
        scheduledAt: "2026-08-19T06:00:00.000Z",
      }),
    );
    expect(next?.toISOString()).toBe("2026-08-19T12:00:00.000Z");
  });

  it("INTERVAL_HOURS falls back to a 6-hour default when recurrenceIntervalHours is missing", () => {
    const next = nextOccurrence(
      buildEvent({ recurrence: "INTERVAL_HOURS", scheduledAt: "2026-08-19T06:00:00.000Z" }),
    );
    expect(next?.toISOString()).toBe("2026-08-19T12:00:00.000Z");
  });
});

describe("resolveCalendarRange", () => {
  it("month=YYYY-MM resolves to the full calendar month bounds", () => {
    const { from, to } = resolveCalendarRange(
      { month: "2026-02" },
      new Date("2026-08-18T00:00:00.000Z"),
    );
    expect(from).toBe("2026-02-01T00:00:00.000Z");
    expect(to).toBe("2026-02-28T23:59:59.999Z");
  });

  it("range=this_week resolves from today through the end of the ISO week (Sunday)", () => {
    // 2026-08-18 is a Tuesday.
    const { from, to } = resolveCalendarRange(
      { range: "this_week" },
      new Date("2026-08-18T12:00:00.000Z"),
    );
    expect(from).toBe("2026-08-18T00:00:00.000Z");
    expect(to).toBe("2026-08-23T23:59:59.999Z");
  });
});

describe("SchedulerService constructor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("constructs without throwing given every real dependency token", () => {
    expect(() => buildService()).not.toThrow();
  });
});

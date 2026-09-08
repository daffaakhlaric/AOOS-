import "reflect-metadata";

import { ok } from "@aos/common";
import { MetaAdsConnectorFactory } from "@aos/meta-ads-connector";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { toConnectorConfig } from "../../config/to-connector-config.js";
import { createFakePublisher } from "../../test-support/fake-publisher.js";
import { buildTestConfig } from "../../test-support/fixtures.js";
import { mswServer, registerSearchAdLocationsMswHandler } from "../../test-support/meta-api-msw.js";
import type { ActivityLogger } from "../activity-log/activity-logger.service.js";
import type { CampaignsService } from "../campaigns/campaigns.service.js";
import { CampaignsService as RealCampaignsService } from "../campaigns/campaigns.service.js";
import type { ListingListResponseDto, ListingResponseDto } from "../listings/dto/listing.dto.js";
import type { ListingsService } from "../listings/listings.service.js";
import type {
  LocationResolverService,
  ResolvedLocation,
} from "../location-resolver/location-resolver.service.js";
import type { ModeGuardService } from "../mode-guard/mode-guard.service.js";
import type { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";

import type { StoredCalendarEvent } from "./domain/calendar-event.js";
import type { CalendarEventRepository } from "./infrastructure/calendar-event.repository.js";
import { SchedulerService } from "./scheduler.service.js";

/**
 * AAOS EPIC S, Phase S6 — the ONE genuine end-to-end test this phase's assessment found missing:
 * every real layer of the PROPERTY campaign-trigger pipeline (S1-S5) already has its own strong,
 * real-MSW-backed test coverage, but ALWAYS with a fake standing in at the SchedulerService <->
 * CampaignsService boundary (`scheduler.service.spec.ts`'s own `buildFakeCampaignsService`).
 * Nowhere does a test wire the REAL `CampaignsService.createPropertyCampaign` (itself already
 * wired to the REAL connector `CreateCampaign.execute`/`SearchAdLocations.execute`) into a REAL
 * `SchedulerService`, so no test proves the two real, independently-tested layers actually compose
 * — e.g. that the object `SchedulerService` passes really satisfies what `CampaignsService` reads
 * off it, or that `SchedulerModule`'s DI wiring (`CampaignsModule` exporting `CampaignsService`)
 * has a real runtime counterpart a plain unit test can't see.
 *
 * Scope, deliberately narrow (this phase is explicitly expected to be light): ONE tenant, ONE
 * triggering PROPERTY listing, LIVE mode, real MSW mocks at the Meta HTTP boundary only — not a
 * battery of edge cases S1-S5's own layered tests already cover individually (empty-match cities,
 * DEV mode, tenant isolation, etc. — see those specs for each).
 *
 * Entry point: `SchedulerService.executeEvent` (a `SAMANTHA_ANALYZE` event), not
 * `checkAndRunDueEvents` — `checkAndRunDueEvents` deliberately fires `executeEvent(event).catch(...)`
 * DETACHED (not awaited) so one slow handler never blocks the next cron tick (see that method's own
 * doc comment); a synchronous, awaitable end-to-end assertion has to await `executeEvent` directly,
 * which is exactly the same function `checkAndRunDueEvents` invokes per due event — this is a
 * faithful stand-in for "a real cron tick", not a weaker substitute for it.
 */
describe("AAOS EPIC S Phase S6 — real end-to-end: cron tick -> SchedulerService -> REAL CampaignsService -> real (MSW-mocked) Meta campaign+adset creation", () => {
  beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
  afterEach(() => mswServer.resetHandlers());
  afterAll(() => mswServer.close());

  const TENANT_ID = "prop-tenant";

  function buildEvent(overrides: Partial<StoredCalendarEvent> = {}): StoredCalendarEvent {
    return {
      id: "evt-e2e-1",
      tenantId: TENANT_ID,
      eventType: "SAMANTHA_ANALYZE",
      title: "Samantha Analyze",
      scheduledAt: "2026-08-19T06:00:00.000Z",
      timezone: "Asia/Jakarta",
      recurrence: "ONCE",
      status: "PENDING",
      createdBy: "system",
      createdAt: "2026-08-18T00:00:00.000Z",
      ...overrides,
    };
  }

  const LISTING: ListingResponseDto = {
    id: "listing-e2e-1",
    title: "Rumah E2E Tanpa Campaign",
    propertyType: "RUMAH",
    listingStatus: "AKTIF",
    price: 1_200_000_000,
    branchId: "BINTARO",
    city: "Tangerang Selatan",
    highlights: [],
    photos: [],
    documents: [],
    inKnowledgeBase: false,
    // Old enough to be past NEW_LISTING_WINDOW_MS (48h) so this fires the honest
    // NO_ACTIVE_CAMPAIGN reason (there are zero ad accounts/campaigns at all in this fixture).
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  /** Real `ListingsService` double satisfying BOTH real consumers in this real flow: `SchedulerService.runPropertyCampaignTriggerCheck` (`.list`) and `CampaignsService.createPropertyCampaign` (`.getById`). */
  function buildRealFlowListingsService(): ListingsService {
    return {
      list: vi.fn(async (): Promise<ListingListResponseDto> => ({ listings: [LISTING], total: 1 })),
      getById: vi.fn(async (tenantId: string, id: string): Promise<ListingResponseDto> => {
        if (tenantId !== TENANT_ID || id !== LISTING.id) {
          throw new Error(`unexpected getById(${tenantId}, ${id})`);
        }
        return LISTING;
      }),
    } as unknown as ListingsService;
  }

  function buildRealFlowLocationResolver(): LocationResolverService {
    const resolved: ResolvedLocation = {
      cities: ["Tangerang Selatan"],
      radiusKm: 20,
      ageMin: 27,
      ageMax: 55,
      source: "FALLBACK",
      reasoning: "e2e fixture",
    };
    return { resolve: vi.fn(async () => resolved) } as unknown as LocationResolverService;
  }

  function buildRealFlowModeGuard(): ModeGuardService {
    return {
      resolveMode: async () => "LIVE",
      executeOrSimulate: async <T>(
        _tenantId: string,
        executeFn: () => Promise<T>,
        _simulateFn: () => Promise<T>,
      ): Promise<T> => executeFn(),
    } as unknown as ModeGuardService;
  }

  function buildRealFlowActivityLogger(): ActivityLogger {
    return {
      start: vi.fn(async () => "activity-e2e"),
      complete: vi.fn(async () => undefined),
      fail: vi.fn(async () => undefined),
      logToolCall: vi.fn(async () => undefined),
      logReasoning: vi.fn(async () => undefined),
    } as unknown as ActivityLogger;
  }

  function buildRealFlowTenantRepository(): TenantRepository {
    return {
      list: vi.fn(async () => [{ tenant_id: TENANT_ID, status: "ACTIVE", vertical: "PROPERTY" }]),
      findByTenantId: vi.fn(async (tenantId: string) =>
        tenantId === TENANT_ID
          ? { tenant_id: TENANT_ID, status: "ACTIVE", vertical: "PROPERTY" }
          : undefined,
      ),
    } as unknown as TenantRepository;
  }

  /** Builds the REAL `CampaignsService` (not a fake) — same real connector wiring `campaigns.service.spec.ts`'s own `buildService` uses, so this test really exercises `resolvePropertyTargeting` -> `CreateCampaign.execute` -> `MetaApiClient` -> MSW. */
  function buildRealCampaignsService(
    listings: ListingsService,
    locationResolver: LocationResolverService,
    modeGuard: ModeGuardService,
    activityLogger: ActivityLogger,
  ): CampaignsService {
    const config = buildTestConfig();
    const connectorConfig = toConnectorConfig(config);
    if (!connectorConfig.ok) {
      throw new Error("test setup failed: toConnectorConfig");
    }
    const connector = MetaAdsConnectorFactory.create({
      config: connectorConfig.value,
      publisher: createFakePublisher(),
    });
    const registry = {
      resolve: async () =>
        ok({
          ...connector,
          accessToken: config.META_ACCESS_TOKEN,
          adAccountIds: config.META_AD_ACCOUNT_IDS,
        }),
    };
    return new RealCampaignsService(
      config,
      registry as never,
      modeGuard,
      activityLogger,
      listings,
      locationResolver,
    );
  }

  it("a real PROPERTY listing that should trigger produces a real Meta campaign+adset POST (HOUSING targeting, real geo-search-resolved city) through the REAL, composed SchedulerService -> CampaignsService pipeline", async () => {
    registerSearchAdLocationsMswHandler({
      "Tangerang Selatan": [{ key: "2360586", name: "Tangerang Selatan, Banten" }],
    });
    let capturedCampaignBody: unknown;
    let capturedAdSetBody: unknown;
    mswServer.use(
      http.post("https://graph.facebook.com/v21.0/:adAccountId/campaigns", async ({ request }) => {
        capturedCampaignBody = await request.json();
        return HttpResponse.json({ id: "120000000000099" });
      }),
      http.post("https://graph.facebook.com/v21.0/:adAccountId/adsets", async ({ request }) => {
        capturedAdSetBody = await request.json();
        return HttpResponse.json({ id: "120000000000100" });
      }),
    );

    const listings = buildRealFlowListingsService();
    const locationResolver = buildRealFlowLocationResolver();
    const modeGuard = buildRealFlowModeGuard();
    const activityLogger = buildRealFlowActivityLogger();
    const campaignsService = buildRealCampaignsService(
      listings,
      locationResolver,
      modeGuard,
      activityLogger,
    );

    const config = buildTestConfig();
    const connectorConfig = toConnectorConfig(config);
    if (!connectorConfig.ok) {
      throw new Error("test setup failed: toConnectorConfig");
    }
    // One real ad account with zero campaigns for pullAdAccounts (pullAdAccounts throws if EVERY
    // account fails, so at least one must succeed) -> matchActiveCampaignForListing always reports
    // hasActiveCampaign: false for this listing, an honest NO_ACTIVE_CAMPAIGN trigger.
    const pulledAdAccount = {
      id: "act_752604553578354",
      name: "E2E Ad Account",
      businessManagerId: "bm_e2e",
      currency: "IDR",
      timezone: "Asia/Jakarta",
      campaigns: [],
      syncedAt: new Date("2026-09-01T00:00:00.000Z"),
    };
    const connectorRegistry = {
      resolve: async () =>
        ok({
          pullCampaignData: {
            execute: vi.fn(async () => ({ ok: true, value: pulledAdAccount })),
          },
          adAccountIds: ["act_752604553578354"],
          accessToken: config.META_ACCESS_TOKEN,
        }),
    };

    const repository = {
      create: vi.fn(),
      findById: vi.fn(async () => buildEvent()),
      listByRange: vi.fn(async () => []),
      listDuePending: vi.fn(async () => []),
      update: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
      markRunning: vi.fn(async () => undefined),
      markDone: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
      markSkipped: vi.fn(async () => undefined),
    } as unknown as CalendarEventRepository;

    const service = new SchedulerService(
      config,
      connectorRegistry as never,
      { runFullScrape: vi.fn() } as never, // scraper — unused by SAMANTHA_ANALYZE
      { getActive: vi.fn() } as never, // objectiveEngine — unused by SAMANTHA_ANALYZE
      { getHotLeadsSince: vi.fn(async () => []) } as never, // leadStore
      { publish: vi.fn(async () => undefined) } as never, // publisher
      { analyze: vi.fn(async () => ({ available: false })) } as never, // llmService
      repository,
      { runRecycling: vi.fn() } as never, // recyclingService — unused
      { checkAndRun: vi.fn() } as never, // abTestingService — unused
      { sync: vi.fn() } as never, // lookalikeService — unused
      { refresh: vi.fn() } as never, // intelligenceService — unused
      { refresh: vi.fn(), getLatest: vi.fn(async () => undefined) } as never, // marketIntelligenceService — unused by this real flow
      { upsertMany: vi.fn(async () => undefined) } as never, // adTenantIndex
      buildRealFlowTenantRepository(),
      listings,
      modeGuard,
      activityLogger,
      campaignsService,
      { record: vi.fn(async () => undefined) } as never, // agentRunsService — AAOS-AI-JUDGE-SELF-IMPROVING Phase J1, unrelated to this real flow's own assertions
      { judgeRun: vi.fn(async () => undefined) } as never, // aiJudgeService — AAOS-AI-JUDGE-SELF-IMPROVING Phase J2, unrelated to this real flow's own assertions
      {
        enqueue: vi.fn(),
        listPending: vi.fn(async () => []),
        approve: vi.fn(),
        reject: vi.fn(),
      } as never, // pendingActions — AAOS-OPERATING-MODE-APPROVAL-GATE, unrelated (tenant fixture is FULL_CONTROL)
      // AAOS Self-Improving (Phase SI-1) — real fallback-passthrough fake, same
      // "no override row exists yet" behavior `AgentConfigService.get` documents on itself, so
      // this real end-to-end flow's HIGH_CPL threshold stays byte-identical to before this phase.
      {
        get: vi.fn(async (_t: string, _a: string, _k: string, fallback: number) => fallback),
      } as never,
      // AAOS Self-Improving (Phase SI-2) — real "no override row exists yet" fake, same
      // zero-behavior-change discipline as `agentConfigService` above — this real end-to-end
      // flow's PAUSE/SCALE digest classification stays byte-identical to before this phase.
      { get: vi.fn(async () => undefined) } as never,
      // AAOS LOOP UPGRADE, Sprint 6 Prompt 17 — real audit_log fake (best-effort, unrelated to
      // this real flow's own assertions).
      { record: vi.fn(async () => undefined) } as never,
      // AAOS LOOP UPGRADE, Sprint 6 Prompt 15 — real "no current objective yet" fake, same
      // zero-behavior-change discipline as the other Self-Improving fakes above — this real
      // end-to-end flow's HIGH_CPL reasoning text stays on the generic-threshold fallback. AAOS
      // LOOP UPGRADE, Sprint 8a — `getAutoLoopSettingsSafe` added the SAME "no current objective
      // yet" real fallback (5 / false), unrelated to this real flow's own assertions (this
      // listing's own NO_ACTIVE_CAMPAIGN trigger has no matching creative_packages row, so
      // NEED_CREATIVE never fires here regardless).
      {
        getCurrentSafe: vi.fn(async () => undefined),
        getAutoLoopSettingsSafe: vi.fn(async () => ({
          maxAutoBriefsPerDay: 5,
          autoApproveCreativeBrief: false,
        })),
      } as never,
      // AAOS LOOP UPGRADE, Sprint 6 Prompt 16 — real "no creative packages yet" fake, unrelated to
      // this real flow's own assertions. AAOS LOOP UPGRADE, Sprint 8a — `countAutoLoopSince`/
      // `create` added for the SAME reason (`runNeedCreativeCheck`'s real wiring), also unrelated
      // to this real flow's own assertions (no NEED_CREATIVE trigger fires here).
      {
        list: vi.fn(async () => []),
        updateFatigueStatus: vi.fn(async () => undefined),
        countAutoLoopSince: vi.fn(async () => 0),
        create: vi.fn(),
      } as never,
    );

    await service.executeEvent(buildEvent());

    // The event completed successfully with the trigger fired, not swallowed as a failure.
    expect(repository.markDone).toHaveBeenCalledWith(
      "evt-e2e-1",
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({
        propertyCampaignTriggersChecked: 1,
        propertyCampaignTriggersFired: 1,
      }),
    );
    expect(repository.markFailed).not.toHaveBeenCalled();

    // The real Meta campaign body really carries specialAdCategories: ["HOUSING"].
    expect(capturedCampaignBody).toMatchObject({ special_ad_categories: ["HOUSING"] });

    // The real Meta adset body really carries the real geo-search-resolved city key, and (the
    // HOUSING invariant S1/S3/S4 each already assert at their own layer) never age/gender targeting.
    expect(capturedAdSetBody).toMatchObject({
      targeting: {
        geo_locations: { cities: [{ key: "2360586", radius: 20, distance_unit: "kilometer" }] },
      },
    });
    const targeting = (capturedAdSetBody as { targeting: Record<string, unknown> }).targeting;
    expect(targeting).not.toHaveProperty("age_min");
    expect(targeting).not.toHaveProperty("age_max");
    expect(targeting).not.toHaveProperty("genders");

    // Both real activity rows this composed flow produces: the scheduler's own
    // CAMPAIGN_TRIGGER_RECOMMENDATION row AND CampaignsService's own CREATE_PROPERTY_CAMPAIGN row
    // (the "double logging" the S5 docstring documents as deliberate) really both fired, both SUCCESS.
    expect(activityLogger.start).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "CAMPAIGN_TRIGGER_RECOMMENDATION", mode: "LIVE" }),
    );
    expect(activityLogger.start).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "CREATE_PROPERTY_CAMPAIGN", mode: "LIVE" }),
    );
    expect(activityLogger.fail).not.toHaveBeenCalled();
  });
});

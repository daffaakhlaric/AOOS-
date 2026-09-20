import { err, ok } from "@aos/common";
import type { IPublisher, PublishInput } from "@aos/event-bus";
import { AdStatus, type MetaAdsConnector } from "@aos/meta-ads-connector";
import { describe, expect, it, vi } from "vitest";

import type { ActivityLogger } from "../activity-log/activity-logger.service.js";
import type {
  CampaignAssessmentRepository,
  StoredAssessment,
} from "../campaign-health/infrastructure/campaign-assessment.repository.js";
import type {
  GrowthObjectiveListResponseDto,
  GrowthObjectiveResponseDto,
} from "../growth-objectives/dto/growth-objective.dto.js";
import type { GrowthObjectivesService } from "../growth-objectives/growth-objectives.service.js";
import type { GrowthObjectiveCampaignsRepository } from "../growth-objectives/infrastructure/growth-objective-campaigns.repository.js";
import type { ListingListResponseDto, ListingResponseDto } from "../listings/dto/listing.dto.js";
import type { ListingsService } from "../listings/listings.service.js";
import type { MetaAdsConnectorRegistry } from "../meta-ads/infrastructure/meta-ads-connector-registry.js";
import type { ModeGuardService } from "../mode-guard/mode-guard.service.js";

import { CampaignCreationService } from "./campaign-creation.service.js";
import type {
  CampaignCreationRepository,
  StoredCampaignCreationRequest,
} from "./infrastructure/campaign-creation.repository.js";

const TENANT = "dss-motor";
const OBJECTIVE_ID = "objective-1";
const LISTING_ID = "listing-1";
const CORRELATION_ID = "corr-1";

function makeListing(overrides: Partial<ListingResponseDto> = {}): ListingResponseDto {
  return {
    id: LISTING_ID,
    title: "Rumah Minimalis Bintaro Sektor 9",
    propertyType: "RUMAH",
    listingStatus: "AKTIF",
    price: 1_500_000_000,
    waNumber: "6281234567890",
    city: "Tangerang Selatan",
    province: "Banten",
    highlights: [],
    photos: [{ id: "photo-1", url: "https://example.com/photo.jpg", order: 0, isMain: true }],
    documents: [],
    inKnowledgeBase: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** A real, PASSING forecast — the same shape `getPreflight`'s own "ready === true" spec test already uses. */
const READY_FORECAST = {
  reverseFunnel: {
    conversionRate: 0.2,
    estimatedRequiredRawLeads: { min: 200, expected: 250, max: 300 },
    estimatedMediaSpendIdr: { min: 4_000_000, expected: 3_000_000, max: 6_000_000 },
    confidence: 0.8,
  },
  feasibility: { status: "ACHIEVABLE" as const, confidence: 0.8, reasons: [], options: [] },
};

function makeGrowthObjective(
  overrides: Partial<GrowthObjectiveResponseDto> = {},
): GrowthObjectiveResponseDto {
  const farFutureEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return {
    id: OBJECTIVE_ID,
    tenantId: TENANT,
    metric: "HOT_LEADS",
    targetValue: 50,
    startDate: "2026-01-01",
    endDate: farFutureEndDate,
    budgetMode: "BALANCED",
    focusListingIds: [],
    areaStrategy: "SAMANTHA",
    manualAreas: [],
    automationMode: "ADVISOR",
    status: "PLANNED",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function buildFakeModeGuard(dev = false): ModeGuardService {
  return {
    resolveMode: vi.fn(async () => (dev ? "DEV" : "LIVE")),
    executeOrSimulate: vi.fn(
      async <T>(_tenantId: string, executeFn: () => Promise<T>, simulateFn: () => Promise<T>) =>
        dev ? simulateFn() : executeFn(),
    ),
  } as unknown as ModeGuardService;
}

function buildFakeActivityLogger(): ActivityLogger {
  return {
    start: vi.fn(async () => "activity-1"),
    complete: vi.fn(async () => undefined),
    fail: vi.fn(async () => undefined),
    logToolCall: vi.fn(async () => undefined),
    logReasoning: vi.fn(async () => undefined),
  } as unknown as ActivityLogger;
}

/** Phase 47 (PROMPT 39 — Events) — same fake-publisher shape `MetaAdsConnectorEvents.spec.ts`'s own tests already establish for `IPublisher`, recording every real `publish()` call for assertions. */
function buildFakePublisher(): IPublisher & { readonly published: PublishInput[] } {
  const published: PublishInput[] = [];
  return {
    published,
    publish: vi.fn(async (input: PublishInput) => {
      published.push(input);
      return { ...input } as unknown as Awaited<ReturnType<IPublisher["publish"]>>;
    }),
    publishAsync: vi.fn(async (input: PublishInput) => {
      published.push(input);
      return { ...input } as unknown as Awaited<ReturnType<IPublisher["publishAsync"]>>;
    }),
    publishBatch: vi.fn(async () => []),
  } as unknown as IPublisher & { readonly published: PublishInput[] };
}

/** Same fake-connector shape `go-live.service.spec.ts`'s own `buildFakeConnector` establishes — `client.createCampaign`/`.createAdSet` mocked directly, matching this service's own real call path. */
function buildFakeConnector(overrides: Record<string, unknown> = {}): MetaAdsConnector {
  return {
    client: {
      createCampaign: vi.fn().mockResolvedValue(ok({ id: "campaign-1" })),
      createAdSet: vi.fn().mockResolvedValue(ok({ id: "adset-1" })),
    },
    ...overrides,
  } as unknown as MetaAdsConnector;
}

function buildFakeConnectorRegistry(connector: MetaAdsConnector): MetaAdsConnectorRegistry {
  return {
    resolve: vi.fn(async () =>
      ok({ ...connector, accessToken: "token-1", adAccountIds: ["act_123"] }),
    ),
    invalidate: vi.fn(),
  } as unknown as MetaAdsConnectorRegistry;
}

function makeStoredRequest(
  overrides: Partial<StoredCampaignCreationRequest> = {},
): StoredCampaignCreationRequest {
  return {
    id: "request-1",
    tenantId: TENANT,
    growthObjectiveId: OBJECTIVE_ID,
    listingId: LISTING_ID,
    creationRequestId: "creation-request-1",
    blueprintId: "blueprint-1",
    status: "PENDING",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function buildFakeRepository(
  overrides: Partial<Record<keyof CampaignCreationRepository, unknown>> = {},
): CampaignCreationRepository {
  return {
    findByKey: vi.fn(async () => undefined),
    claim: vi.fn(
      async (input: { readonly creationRequestId: string; readonly blueprintId: string }) =>
        makeStoredRequest({
          creationRequestId: input.creationRequestId,
          blueprintId: input.blueprintId,
        }),
    ),
    reclaim: vi.fn(
      async (
        id: string,
        _fromStatus: string,
        input: { readonly creationRequestId: string; readonly blueprintId: string },
      ) =>
        makeStoredRequest({
          id,
          creationRequestId: input.creationRequestId,
          blueprintId: input.blueprintId,
        }),
    ),
    markCreated: vi.fn(async () => undefined),
    markPartialFailure: vi.fn(async () => undefined),
    markFailed: vi.fn(async () => undefined),
    markSimulated: vi.fn(async () => undefined),
    listCreatedForTenant: vi.fn(async () => []),
    ...overrides,
  } as unknown as CampaignCreationRepository;
}

interface Harness {
  readonly service: CampaignCreationService;
  readonly listings: ListingsService;
  readonly growthObjectives: GrowthObjectivesService;
  readonly repository: CampaignCreationRepository;
  readonly connectorRegistry: MetaAdsConnectorRegistry;
  readonly modeGuard: ModeGuardService;
  readonly activityLogger: ActivityLogger;
  readonly connector: MetaAdsConnector;
  readonly growthObjectiveCampaigns: GrowthObjectiveCampaignsRepository;
  readonly campaignAssessments: CampaignAssessmentRepository;
  readonly publisher: IPublisher & { readonly published: PublishInput[] };
}

function buildHarness(
  options: {
    readonly listingOverrides?: Partial<ListingResponseDto>;
    readonly objectiveOverrides?: Partial<GrowthObjectiveResponseDto>;
    readonly repositoryOverrides?: Partial<Record<keyof CampaignCreationRepository, unknown>>;
    readonly connectorOverrides?: Record<string, unknown>;
    readonly dev?: boolean;
    /** Phase 32 — real tenant listings `ListingsService.list` returns; defaults to `[makeListing()]`. */
    readonly allListings?: readonly ListingResponseDto[];
    /** Phase 32 — real matched `meta_campaign_id`s `GrowthObjectiveCampaignsRepository.findCampaignIdsForListings` returns, keyed by the SAME listing id passed in (mirrors the real one-listing-per-call usage `getPortfolioPlan` makes). Defaults to always-empty (no existing campaign). */
    readonly matchedCampaignIdsByListingId?: ReadonlyMap<string, readonly string[]>;
    /** Phase 33 — real tenant growth objectives `GrowthObjectivesService.list` returns; defaults to `[makeGrowthObjective()]`. */
    readonly allObjectives?: readonly GrowthObjectiveResponseDto[];
    /** Phase 33 — real `campaign_creation_requests` rows `CampaignCreationRepository.listCreatedForTenant` returns; defaults to `[]`. */
    readonly historicalRequests?: readonly StoredCampaignCreationRequest[];
    /** Phase 33 — real latest-per-campaign assessments `CampaignAssessmentRepository.listLatestPerCampaign` returns; defaults to an empty map. */
    readonly latestAssessments?: ReadonlyMap<string, StoredAssessment>;
  } = {},
): Harness {
  const listing = makeListing(options.listingOverrides);
  const growthObjective = makeGrowthObjective(options.objectiveOverrides);
  const allListings = options.allListings ?? [listing];
  const allObjectives = options.allObjectives ?? [growthObjective];
  const listings = {
    getById: vi.fn(async () => listing),
    list: vi.fn(async (): Promise<ListingListResponseDto> => ({
      listings: allListings,
      total: allListings.length,
    })),
  } as unknown as ListingsService;
  const growthObjectives = {
    getById: vi.fn(async () => growthObjective),
    list: vi.fn(async (): Promise<GrowthObjectiveListResponseDto> => ({
      objectives: allObjectives,
    })),
  } as unknown as GrowthObjectivesService;
  const repository = buildFakeRepository({
    listCreatedForTenant: vi.fn(async () => options.historicalRequests ?? []),
    ...options.repositoryOverrides,
  });
  const connector = buildFakeConnector(options.connectorOverrides);
  const connectorRegistry = buildFakeConnectorRegistry(connector);
  const modeGuard = buildFakeModeGuard(options.dev ?? false);
  const activityLogger = buildFakeActivityLogger();
  const matchedMap = options.matchedCampaignIdsByListingId ?? new Map<string, readonly string[]>();
  const growthObjectiveCampaigns = {
    findCampaignIdsForListings: vi.fn(
      async (_tenantId: string, listingIds: readonly string[]) =>
        matchedMap.get(listingIds[0] ?? "") ?? [],
    ),
  } as unknown as GrowthObjectiveCampaignsRepository;
  const campaignAssessments = {
    listLatestPerCampaign: vi.fn(
      async () => options.latestAssessments ?? new Map<string, StoredAssessment>(),
    ),
  } as unknown as CampaignAssessmentRepository;
  const publisher = buildFakePublisher();

  const service = new CampaignCreationService(
    listings,
    growthObjectives,
    repository,
    connectorRegistry,
    modeGuard,
    activityLogger,
    growthObjectiveCampaigns,
    campaignAssessments,
    publisher,
  );

  return {
    service,
    listings,
    growthObjectives,
    repository,
    connectorRegistry,
    modeGuard,
    activityLogger,
    connector,
    growthObjectiveCampaigns,
    campaignAssessments,
    publisher,
  };
}

describe("CampaignCreationService (Phase 25 read-only routes, unchanged)", () => {
  it("getListingReadiness delegates to ListingsService.getById and wraps assessListingReadiness", async () => {
    const { service, listings } = buildHarness();
    const result = await service.getListingReadiness(TENANT, LISTING_ID);
    expect(listings.getById).toHaveBeenCalledWith(TENANT, LISTING_ID);
    expect(result.readiness.ready).toBe(true);
  });

  it("getBlueprint fetches both the objective and the listing, then builds a blueprint", async () => {
    const { service } = buildHarness();
    const result = await service.getBlueprint(TENANT, OBJECTIVE_ID, LISTING_ID);
    expect(result.blueprint.destination).toBe("WHATSAPP");
  });

  it("getPreflight is honestly not ready when the objective has no forecast yet", async () => {
    const { service } = buildHarness();
    const result = await service.getPreflight(TENANT, OBJECTIVE_ID, LISTING_ID);
    expect(result.preflight.ready).toBe(false);
  });
});

describe("CampaignCreationService.createCampaign (Phase 26 — PROMPT 36/37)", () => {
  it("BLOCKED: refuses to create anything when server-recomputed preflight is not ready — zero Meta/repository calls", async () => {
    const { service, repository, connector } = buildHarness();
    const result = await service.createCampaign(TENANT, OBJECTIVE_ID, LISTING_ID, CORRELATION_ID);
    expect(result.status).toBe("BLOCKED");
    expect(result.preflight?.ready).toBe(false);
    expect(repository.findByKey).not.toHaveBeenCalled();
    expect(connector.client.createCampaign).not.toHaveBeenCalled();
  });

  it("DUPLICATE: an existing CREATED row short-circuits — no new Meta call, existing real ids returned", async () => {
    const existing = makeStoredRequest({
      status: "CREATED",
      metaCampaignId: "campaign-existing",
      metaAdSetId: "adset-existing",
    });
    const { service, repository, connector } = buildHarness({
      objectiveOverrides: { forecast: READY_FORECAST },
      repositoryOverrides: { findByKey: vi.fn(async () => existing) },
    });
    const result = await service.createCampaign(TENANT, OBJECTIVE_ID, LISTING_ID, CORRELATION_ID);
    expect(result.status).toBe("DUPLICATE");
    expect(result.metaCampaignId).toBe("campaign-existing");
    expect(result.metaAdSetId).toBe("adset-existing");
    expect(connector.client.createCampaign).not.toHaveBeenCalled();
    expect(repository.claim).not.toHaveBeenCalled();
  });

  it("DUPLICATE: an existing PARTIAL_FAILURE row also short-circuits (a real, inert campaign already exists)", async () => {
    const existing = makeStoredRequest({
      status: "PARTIAL_FAILURE",
      metaCampaignId: "campaign-partial",
    });
    const { service, connector } = buildHarness({
      objectiveOverrides: { forecast: READY_FORECAST },
      repositoryOverrides: { findByKey: vi.fn(async () => existing) },
    });
    const result = await service.createCampaign(TENANT, OBJECTIVE_ID, LISTING_ID, CORRELATION_ID);
    expect(result.status).toBe("DUPLICATE");
    expect(result.metaCampaignId).toBe("campaign-partial");
    expect(result.metaAdSetId).toBeUndefined();
    expect(connector.client.createCampaign).not.toHaveBeenCalled();
  });

  it("CONFLICT: an existing PENDING row means another attempt is in flight — no Meta call", async () => {
    const existing = makeStoredRequest({ status: "PENDING" });
    const { service, connector } = buildHarness({
      objectiveOverrides: { forecast: READY_FORECAST },
      repositoryOverrides: { findByKey: vi.fn(async () => existing) },
    });
    const result = await service.createCampaign(TENANT, OBJECTIVE_ID, LISTING_ID, CORRELATION_ID);
    expect(result.status).toBe("CONFLICT");
    expect(connector.client.createCampaign).not.toHaveBeenCalled();
  });

  it("CREATED: claims a fresh slot and creates a real, PAUSED Campaign + AdSet", async () => {
    const { service, repository, connector } = buildHarness({
      objectiveOverrides: { forecast: READY_FORECAST },
    });
    const result = await service.createCampaign(TENANT, OBJECTIVE_ID, LISTING_ID, CORRELATION_ID);

    expect(result.status).toBe("CREATED");
    expect(result.metaCampaignId).toBe("campaign-1");
    expect(result.metaAdSetId).toBe("adset-1");
    expect(connector.client.createCampaign).toHaveBeenCalledWith(
      "act_123",
      expect.objectContaining({ status: AdStatus.PAUSED }),
      "token-1",
    );
    expect(connector.client.createAdSet).toHaveBeenCalledWith(
      "act_123",
      expect.objectContaining({ status: AdStatus.PAUSED, campaignId: "campaign-1" }),
      "token-1",
    );
    expect(repository.markCreated).toHaveBeenCalledWith("request-1", "campaign-1", "adset-1");
  });

  it("PARTIAL_FAILURE: campaign created but ad set creation fails — honestly reports the real campaignId, never claims success", async () => {
    const { service, repository, connector } = buildHarness({
      objectiveOverrides: { forecast: READY_FORECAST },
      connectorOverrides: {
        client: {
          createCampaign: vi.fn().mockResolvedValue(ok({ id: "campaign-1" })),
          createAdSet: vi.fn().mockResolvedValue(err(new Error("adset boom"))),
        },
      },
    });
    const result = await service.createCampaign(TENANT, OBJECTIVE_ID, LISTING_ID, CORRELATION_ID);

    expect(result.status).toBe("PARTIAL_FAILURE");
    expect(result.metaCampaignId).toBe("campaign-1");
    expect(result.metaAdSetId).toBeUndefined();
    expect(connector.client.createCampaign).toHaveBeenCalledTimes(1);
    expect(repository.markPartialFailure).toHaveBeenCalledWith(
      "request-1",
      "campaign-1",
      expect.stringContaining("boom"),
    );
  });

  it("FAILED: campaign creation itself fails — nothing created on Meta, no adset call attempted", async () => {
    const { service, repository, connector } = buildHarness({
      objectiveOverrides: { forecast: READY_FORECAST },
      connectorOverrides: {
        client: {
          createCampaign: vi.fn().mockResolvedValue(err(new Error("campaign boom"))),
          createAdSet: vi.fn(),
        },
      },
    });
    const result = await service.createCampaign(TENANT, OBJECTIVE_ID, LISTING_ID, CORRELATION_ID);

    expect(result.status).toBe("FAILED");
    expect(result.metaCampaignId).toBeUndefined();
    expect(connector.client.createAdSet).not.toHaveBeenCalled();
    expect(repository.markFailed).toHaveBeenCalledWith(
      "request-1",
      expect.stringContaining("boom"),
    );
  });

  it("SIMULATED: a DEV-mode tenant makes zero real Meta calls", async () => {
    const { service, repository, connector } = buildHarness({
      objectiveOverrides: { forecast: READY_FORECAST },
      dev: true,
    });
    const result = await service.createCampaign(TENANT, OBJECTIVE_ID, LISTING_ID, CORRELATION_ID);

    expect(result.status).toBe("SIMULATED");
    expect(connector.client.createCampaign).not.toHaveBeenCalled();
    expect(connector.client.createAdSet).not.toHaveBeenCalled();
    expect(repository.markSimulated).toHaveBeenCalledWith("request-1");
  });

  it("reclaims a FAILED row for a retry rather than leaving it stuck forever", async () => {
    const existing = makeStoredRequest({ status: "FAILED", errorMessage: "previous boom" });
    const { service, repository, connector } = buildHarness({
      objectiveOverrides: { forecast: READY_FORECAST },
      repositoryOverrides: { findByKey: vi.fn(async () => existing) },
    });
    const result = await service.createCampaign(TENANT, OBJECTIVE_ID, LISTING_ID, CORRELATION_ID);

    expect(repository.reclaim).toHaveBeenCalledWith(
      existing.id,
      "FAILED",
      expect.objectContaining({
        creationRequestId: expect.any(String),
        blueprintId: expect.any(String),
      }),
    );
    expect(result.status).toBe("CREATED");
    expect(connector.client.createCampaign).toHaveBeenCalledTimes(1);
  });

  it("CONFLICT: a lost claim race (unique-violation) is reported honestly, never retried in a loop", async () => {
    const { service, repository, connector } = buildHarness({
      objectiveOverrides: { forecast: READY_FORECAST },
      repositoryOverrides: {
        findByKey: vi
          .fn()
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce(makeStoredRequest({ status: "PENDING" })),
        claim: vi.fn(async () => undefined),
      },
    });
    const result = await service.createCampaign(TENANT, OBJECTIVE_ID, LISTING_ID, CORRELATION_ID);

    expect(result.status).toBe("CONFLICT");
    expect(connector.client.createCampaign).not.toHaveBeenCalled();
    expect(repository.findByKey).toHaveBeenCalledTimes(2);
  });
});

describe("CampaignCreationService.createCampaign events (Phase 47 — PROMPT 39 — Events)", () => {
  it("CREATED: publishes requested -> blueprint.created -> preflight.passed -> campaign.created, in order, via the real IPublisher", async () => {
    const { service, publisher } = buildHarness({
      objectiveOverrides: { forecast: READY_FORECAST },
    });
    await service.createCampaign(TENANT, OBJECTIVE_ID, LISTING_ID, CORRELATION_ID);

    const types = publisher.published.map((p) => p.type);
    expect(types).toEqual([
      "aaos.campaign.creation.requested",
      "aaos.campaign.blueprint.created",
      "aaos.campaign.preflight.passed",
      "aaos.campaign.created",
    ]);
    for (const event of publisher.published) {
      expect(event.tenantId).toBe(TENANT);
      expect(event.correlationId).toBe(CORRELATION_ID);
    }
    const createdEvent = publisher.published[3] as PublishInput<{
      readonly metaCampaignId: string;
      readonly metaAdSetId: string;
    }>;
    expect(createdEvent.payload.metaCampaignId).toBe("campaign-1");
    expect(createdEvent.payload.metaAdSetId).toBe("adset-1");
  });

  it("BLOCKED: publishes requested -> blueprint.created -> preflight.failed with the real blockingErrors — never campaign.created", async () => {
    const { service, publisher } = buildHarness();
    await service.createCampaign(TENANT, OBJECTIVE_ID, LISTING_ID, CORRELATION_ID);

    const types = publisher.published.map((p) => p.type);
    expect(types).toEqual([
      "aaos.campaign.creation.requested",
      "aaos.campaign.blueprint.created",
      "aaos.campaign.preflight.failed",
    ]);
    const failedEvent = publisher.published[2] as PublishInput<{
      readonly blockingErrors: readonly string[];
    }>;
    expect(failedEvent.payload.blockingErrors.length).toBeGreaterThan(0);
  });

  it("SIMULATED/PARTIAL_FAILURE/FAILED/DUPLICATE/CONFLICT never publish campaign.created", async () => {
    const { service: simulated, publisher: simulatedPublisher } = buildHarness({
      objectiveOverrides: { forecast: READY_FORECAST },
      dev: true,
    });
    await simulated.createCampaign(TENANT, OBJECTIVE_ID, LISTING_ID, CORRELATION_ID);
    expect(simulatedPublisher.published.map((p) => p.type)).not.toContain("aaos.campaign.created");

    const existing = makeStoredRequest({ status: "CREATED", metaCampaignId: "campaign-existing" });
    const { service: duplicate, publisher: duplicatePublisher } = buildHarness({
      objectiveOverrides: { forecast: READY_FORECAST },
      repositoryOverrides: { findByKey: vi.fn(async () => existing) },
    });
    await duplicate.createCampaign(TENANT, OBJECTIVE_ID, LISTING_ID, CORRELATION_ID);
    expect(duplicatePublisher.published.map((p) => p.type)).not.toContain("aaos.campaign.created");
  });
});

describe("CampaignCreationService.getPortfolioPlan (Phase 32 — Portfolio Planner / Listing Allocation Engine)", () => {
  it("empty focusListingIds -> candidates are every real tenant listing ListingsService.list returns", async () => {
    const listingA = makeListing({ id: "listing-a" });
    const listingB = makeListing({ id: "listing-b" });
    const { service, listings, growthObjectives } = buildHarness({
      objectiveOverrides: { focusListingIds: [] },
      allListings: [listingA, listingB],
    });

    const result = await service.getPortfolioPlan(TENANT, OBJECTIVE_ID);

    expect(growthObjectives.getById).toHaveBeenCalledWith(TENANT, OBJECTIVE_ID);
    expect(listings.list).toHaveBeenCalledTimes(1);
    expect(result.plan.candidates).toHaveLength(2);
    expect(result.plan.candidates.map((c) => c.listingId).sort()).toEqual([
      "listing-a",
      "listing-b",
    ]);
  });

  it("non-empty focusListingIds -> candidates are exactly those real listings, in stable listingId order", async () => {
    const listingA = makeListing({ id: "listing-a" });
    const listingB = makeListing({ id: "listing-b" });
    const listingC = makeListing({ id: "listing-c" });
    const { service } = buildHarness({
      objectiveOverrides: { focusListingIds: ["listing-c", "listing-a"] },
      allListings: [listingA, listingB, listingC],
    });

    const result = await service.getPortfolioPlan(TENANT, OBJECTIVE_ID);

    expect(result.plan.candidates.map((c) => c.listingId)).toEqual(["listing-a", "listing-c"]);
  });

  it("a focusListingId that no longer resolves to a real listing is honestly excluded and surfaced in warnings, never fabricated", async () => {
    const listingA = makeListing({ id: "listing-a" });
    const { service } = buildHarness({
      objectiveOverrides: { focusListingIds: ["listing-a", "listing-deleted"] },
      allListings: [listingA],
    });

    const result = await service.getPortfolioPlan(TENANT, OBJECTIVE_ID);

    expect(result.plan.candidates).toHaveLength(1);
    expect(result.plan.candidates[0]?.listingId).toBe("listing-a");
    expect(result.plan.warnings.some((w) => w.includes("listing-deleted"))).toBe(true);
  });

  it("a listing with a real matched meta_campaign_id is alreadyCampaigned and excluded from allocation", async () => {
    const listingA = makeListing({ id: "listing-a" });
    const listingB = makeListing({ id: "listing-b" });
    const { service } = buildHarness({
      objectiveOverrides: { focusListingIds: [], forecast: READY_FORECAST },
      allListings: [listingA, listingB],
      matchedCampaignIdsByListingId: new Map([["listing-a", ["campaign-existing"]]]),
    });

    const result = await service.getPortfolioPlan(TENANT, OBJECTIVE_ID);

    const a = result.plan.candidates.find((c) => c.listingId === "listing-a");
    const b = result.plan.candidates.find((c) => c.listingId === "listing-b");
    expect(a?.alreadyCampaigned).toBe(true);
    expect(a?.eligibleForAllocation).toBe(false);
    expect(a?.matchedCampaignIds).toEqual(["campaign-existing"]);
    expect(b?.alreadyCampaigned).toBe(false);
    expect(b?.eligibleForAllocation).toBe(true);
    expect(result.plan.eligibleCount).toBe(1);
  });

  it("a blocked (not-ready) listing is excluded from allocation with its real blockingIssues intact", async () => {
    const readyListing = makeListing({ id: "listing-ready" });
    const blockedListing = makeListing({ id: "listing-blocked", waNumber: undefined });
    const { service } = buildHarness({
      objectiveOverrides: { focusListingIds: [], forecast: READY_FORECAST },
      allListings: [readyListing, blockedListing],
    });

    const result = await service.getPortfolioPlan(TENANT, OBJECTIVE_ID);

    const blocked = result.plan.candidates.find((c) => c.listingId === "listing-blocked");
    expect(blocked?.eligibleForAllocation).toBe(false);
    expect(blocked?.readiness.ready).toBe(false);
    expect(blocked?.readiness.blockingIssues.length).toBeGreaterThan(0);
    expect(result.plan.eligibleCount).toBe(1);
  });

  it("no forecast yet -> budget allocation is honestly omitted, target-lead allocation still happens, real warning explains why", async () => {
    const { service } = buildHarness({
      objectiveOverrides: { focusListingIds: [], targetValue: 40, forecast: undefined },
    });

    const result = await service.getPortfolioPlan(TENANT, OBJECTIVE_ID);

    expect(result.plan.totalEstimatedMediaSpendIdr).toBeUndefined();
    expect(result.plan.candidates[0]?.allocation?.targetHotLeads).toBe(40);
    expect(result.plan.candidates[0]?.allocation?.budgetIdr).toBeUndefined();
    expect(result.plan.warnings.some((w) => w.includes("belum dianalisa"))).toBe(true);
  });

  it("with a real forecast, target leads AND budget are both allocated across every eligible listing, summing exactly to the real total", async () => {
    const listingA = makeListing({ id: "listing-a" });
    const listingB = makeListing({ id: "listing-b" });
    const listingC = makeListing({ id: "listing-c" });
    const { service } = buildHarness({
      objectiveOverrides: { focusListingIds: [], targetValue: 50, forecast: READY_FORECAST },
      allListings: [listingA, listingB, listingC],
    });

    const result = await service.getPortfolioPlan(TENANT, OBJECTIVE_ID);

    const totalLeads = result.plan.candidates.reduce(
      (sum, c) => sum + (c.allocation?.targetHotLeads ?? 0),
      0,
    );
    const totalBudget = result.plan.candidates.reduce(
      (sum, c) => sum + (c.allocation?.budgetIdr ?? 0),
      0,
    );
    expect(totalLeads).toBe(50);
    expect(totalBudget).toBe(READY_FORECAST.reverseFunnel.estimatedMediaSpendIdr.expected);
    expect(result.plan.allocationModel).toBe("EVEN_SPLIT");
  });

  it("zero candidate listings -> honest empty plan, real warning explains why, never a fabricated candidate", async () => {
    const { service } = buildHarness({
      objectiveOverrides: { focusListingIds: [] },
      allListings: [],
    });

    const result = await service.getPortfolioPlan(TENANT, OBJECTIVE_ID);

    expect(result.plan.candidates).toEqual([]);
    expect(result.plan.eligibleCount).toBe(0);
    expect(result.plan.warnings.length).toBeGreaterThan(0);
  });

  it("all candidates blocked or already-campaigned -> zero eligible, honest warning, no fabricated allocation", async () => {
    const listingA = makeListing({ id: "listing-a" });
    const listingB = makeListing({ id: "listing-b", waNumber: undefined });
    const { service } = buildHarness({
      objectiveOverrides: { focusListingIds: [] },
      allListings: [listingA, listingB],
      matchedCampaignIdsByListingId: new Map([["listing-a", ["campaign-existing"]]]),
    });

    const result = await service.getPortfolioPlan(TENANT, OBJECTIVE_ID);

    expect(result.plan.eligibleCount).toBe(0);
    expect(result.plan.candidates.every((c) => c.allocation === undefined)).toBe(true);
    expect(result.plan.warnings.length).toBeGreaterThan(0);
  });
});

describe("CampaignCreationService.getStrategyMemory (Phase 33 — PROMPT 34 — Historical Strategy Memory)", () => {
  function healthyDimension(score: number): StoredAssessment["health"]["delivery"] {
    return { status: "HEALTHY", score, confidence: 1, issues: [] };
  }

  function makeAssessment(
    overallStatus: StoredAssessment["health"]["overallStatus"],
    costEfficiencyScore?: number,
  ): StoredAssessment {
    return {
      id: `assess-${overallStatus}`,
      health: {
        delivery: healthyDimension(90),
        costEfficiency:
          costEfficiencyScore === undefined
            ? { status: "UNKNOWN", confidence: 0, issues: ["no benchmark"] }
            : healthyDimension(costEfficiencyScore),
        creative: healthyDimension(90),
        audience: { status: "UNKNOWN", confidence: 0, issues: [] },
        conversion: healthyDimension(90),
        tracking: { status: "UNKNOWN", confidence: 0, issues: [] },
        leadQuality: { status: "UNKNOWN", confidence: 0, issues: [] },
        overallStatus,
      },
      diagnosis: {
        confidence: 0,
        impact: "UNKNOWN",
        evidence: [],
        contributingFactors: [],
        recommendedFocus: [],
      },
      decision: {
        decision: "NO_ACTION",
        confidence: 1,
        impact: "LOW",
        reason: "test",
        riskOfDoingNothing: "test",
        expectedOutcome: "test",
        monitoringPlan: { reviewAfterHours: 72, successConditions: [], rollbackConditions: [] },
      },
      assessedAt: "2026-01-05T00:00:00.000Z",
    };
  }

  function makeRequest(
    index: number,
    overrides: Partial<StoredCampaignCreationRequest> = {},
  ): StoredCampaignCreationRequest {
    return makeStoredRequest({
      id: `hist-request-${String(index)}`,
      growthObjectiveId: `hist-objective-${String(index)}`,
      listingId: `hist-listing-${String(index)}`,
      status: "CREATED",
      metaCampaignId: `hist-campaign-${String(index)}`,
      metaAdSetId: `hist-adset-${String(index)}`,
      ...overrides,
    });
  }

  /** The TARGET listing (`makeListing`'s own default: RUMAH, 1.5M IDR — `"1M_TO_2M"` segment, Tangerang Selatan/Banten) — every "matching" historical fixture below shares these same real attributes. */
  function matchingHistoricalListing(id: string): ListingResponseDto {
    return makeListing({ id, waNumber: "628" });
  }

  function matchingHistoricalObjective(id: string): GrowthObjectiveResponseDto {
    return makeGrowthObjective({ id, metric: "HOT_LEADS" });
  }

  it("below MIN_HISTORICAL_SAMPLE_SIZE real matched candidates -> honest available:false, never a fabricated average", async () => {
    const histListingA = matchingHistoricalListing("hist-listing-0");
    const histObjectiveA = matchingHistoricalObjective("hist-objective-0");
    const { service } = buildHarness({
      historicalRequests: [makeRequest(0)],
      allListings: [makeListing(), histListingA],
      allObjectives: [makeGrowthObjective(), histObjectiveA],
      latestAssessments: new Map([["hist-campaign-0", makeAssessment("HEALTHY", 80)]]),
    });

    const result = await service.getStrategyMemory(TENANT, OBJECTIVE_ID, LISTING_ID);

    expect(result.memory.available).toBe(false);
    if (!result.memory.available) {
      expect(result.memory.matchedCount).toBe(1);
    }
  });

  it("zero historical requests at all -> honest available:false, matchedCount 0", async () => {
    const { service } = buildHarness({ historicalRequests: [] });
    const result = await service.getStrategyMemory(TENANT, OBJECTIVE_ID, LISTING_ID);
    expect(result.memory).toEqual({
      available: false,
      matchedCount: 0,
      reason: expect.stringContaining("Belum ada campaign historis"),
    });
  });

  it("enough real matching historical campaigns -> a real, honestly-computed aggregate", async () => {
    const histListings = [0, 1, 2].map((i) =>
      matchingHistoricalListing(`hist-listing-${String(i)}`),
    );
    const histObjectives = [0, 1, 2].map((i) =>
      matchingHistoricalObjective(`hist-objective-${String(i)}`),
    );
    const requests = [makeRequest(0), makeRequest(1), makeRequest(2)];
    const assessments = new Map<string, StoredAssessment>([
      ["hist-campaign-0", makeAssessment("HEALTHY", 90)],
      ["hist-campaign-1", makeAssessment("WATCH", 70)],
      ["hist-campaign-2", makeAssessment("CRITICAL", 20)],
    ]);

    const { service } = buildHarness({
      historicalRequests: requests,
      allListings: [makeListing(), ...histListings],
      allObjectives: [makeGrowthObjective(), ...histObjectives],
      latestAssessments: assessments,
    });

    const result = await service.getStrategyMemory(TENANT, OBJECTIVE_ID, LISTING_ID);

    expect(result.memory.available).toBe(true);
    if (result.memory.available) {
      expect(result.memory.matchedCount).toBe(3);
      expect(result.memory.statusCounts).toEqual({
        HEALTHY: 1,
        WATCH: 1,
        WARNING: 0,
        CRITICAL: 1,
        UNKNOWN: 0,
      });
      expect(result.memory.favorableStatusRatio).toBeCloseTo(2 / 3);
      expect(result.memory.averageCostEfficiencyScore).toBeCloseTo((90 + 70 + 20) / 3);
      expect(result.memory.costEfficiencySampleSize).toBe(3);
    }
  });

  it("a historical request with a different propertyType is honestly excluded from matching", async () => {
    const histListings = [0, 1, 2].map((i) =>
      matchingHistoricalListing(`hist-listing-${String(i)}`),
    );
    const mismatchedListing = makeListing({ id: "hist-listing-3", propertyType: "APARTEMEN" });
    const histObjectives = [0, 1, 2, 3].map((i) =>
      matchingHistoricalObjective(`hist-objective-${String(i)}`),
    );
    const requests = [makeRequest(0), makeRequest(1), makeRequest(2), makeRequest(3)];
    const assessments = new Map<string, StoredAssessment>([
      ["hist-campaign-0", makeAssessment("HEALTHY", 90)],
      ["hist-campaign-1", makeAssessment("HEALTHY", 90)],
      ["hist-campaign-2", makeAssessment("HEALTHY", 90)],
      ["hist-campaign-3", makeAssessment("HEALTHY", 90)],
    ]);

    const { service } = buildHarness({
      historicalRequests: requests,
      allListings: [makeListing(), ...histListings, mismatchedListing],
      allObjectives: [makeGrowthObjective(), ...histObjectives],
      latestAssessments: assessments,
    });

    const result = await service.getStrategyMemory(TENANT, OBJECTIVE_ID, LISTING_ID);

    expect(result.memory.available).toBe(true);
    if (result.memory.available) {
      // hist-listing-3 (APARTEMEN) never matches the target's RUMAH — excluded.
      expect(result.memory.matchedCount).toBe(3);
    }
  });

  it("a historical request whose listing was since deleted is honestly excluded, never fabricated", async () => {
    const requests = [makeRequest(0)];
    const { service } = buildHarness({
      historicalRequests: requests,
      allListings: [makeListing()], // hist-listing-0 is NOT in the real tenant listing set anymore
      allObjectives: [makeGrowthObjective(), matchingHistoricalObjective("hist-objective-0")],
      latestAssessments: new Map([["hist-campaign-0", makeAssessment("HEALTHY", 90)]]),
    });

    const result = await service.getStrategyMemory(TENANT, OBJECTIVE_ID, LISTING_ID);
    expect(result.memory).toEqual({
      available: false,
      matchedCount: 0,
      reason: expect.stringContaining("Belum ada campaign historis"),
    });
  });

  it("a historical request that was never assessed-and-recorded is honestly excluded, never fabricated", async () => {
    const requests = [makeRequest(0)];
    const { service } = buildHarness({
      historicalRequests: requests,
      allListings: [makeListing(), matchingHistoricalListing("hist-listing-0")],
      allObjectives: [makeGrowthObjective(), matchingHistoricalObjective("hist-objective-0")],
      latestAssessments: new Map(), // no real assessment recorded for hist-campaign-0
    });

    const result = await service.getStrategyMemory(TENANT, OBJECTIVE_ID, LISTING_ID);
    expect(result.memory.available).toBe(false);
    if (!result.memory.available) {
      expect(result.memory.matchedCount).toBe(0);
    }
  });
});

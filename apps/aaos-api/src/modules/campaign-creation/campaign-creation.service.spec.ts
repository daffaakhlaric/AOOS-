import { err, ok } from "@aos/common";
import { AdStatus, type MetaAdsConnector } from "@aos/meta-ads-connector";
import { describe, expect, it, vi } from "vitest";

import type { ActivityLogger } from "../activity-log/activity-logger.service.js";
import type { GrowthObjectiveResponseDto } from "../growth-objectives/dto/growth-objective.dto.js";
import type { GrowthObjectivesService } from "../growth-objectives/growth-objectives.service.js";
import type { ListingResponseDto } from "../listings/dto/listing.dto.js";
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
}

function buildHarness(
  options: {
    readonly listingOverrides?: Partial<ListingResponseDto>;
    readonly objectiveOverrides?: Partial<GrowthObjectiveResponseDto>;
    readonly repositoryOverrides?: Partial<Record<keyof CampaignCreationRepository, unknown>>;
    readonly connectorOverrides?: Record<string, unknown>;
    readonly dev?: boolean;
  } = {},
): Harness {
  const listing = makeListing(options.listingOverrides);
  const growthObjective = makeGrowthObjective(options.objectiveOverrides);
  const listings = { getById: vi.fn(async () => listing) } as unknown as ListingsService;
  const growthObjectives = {
    getById: vi.fn(async () => growthObjective),
  } as unknown as GrowthObjectivesService;
  const repository = buildFakeRepository(options.repositoryOverrides);
  const connector = buildFakeConnector(options.connectorOverrides);
  const connectorRegistry = buildFakeConnectorRegistry(connector);
  const modeGuard = buildFakeModeGuard(options.dev ?? false);
  const activityLogger = buildFakeActivityLogger();

  const service = new CampaignCreationService(
    listings,
    growthObjectives,
    repository,
    connectorRegistry,
    modeGuard,
    activityLogger,
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

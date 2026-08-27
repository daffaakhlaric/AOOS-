import { BranchId } from "@aos/branch-manager";
import type { CapiConnector } from "@aos/capi-connector";
import { err, ok } from "@aos/common";
import { NotFoundError } from "@aos/errors";
import type { IClosingRepository, Lead, LeadStore } from "@aos/lead-store";
import { GoogleTrendsService, SeasonalCalendarService } from "@aos/meta-ads-agent";
import type { MetaAdsConnector } from "@aos/meta-ads-connector";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildTestConfig } from "../../test-support/fixtures.js";
import type {
  ListingRepository,
  ListingRow,
} from "../listings/infrastructure/listing.repository.js";
import type { CampaignStrategyResponseDto } from "../llm/dto/campaign-strategy.dto.js";
import type { LlmService } from "../llm/llm.service.js";
import type {
  TenantRepository,
  TenantRow,
} from "../superadmin/infrastructure/tenant.repository.js";

import type { CompetitorPageRepository } from "./infrastructure/competitor-page.repository.js";
import type { IntelligenceSignalsRepository } from "./infrastructure/intelligence-signals.repository.js";
import { IntelligenceService } from "./intelligence.service.js";

const NOW = new Date("2026-08-20T10:00:00.000Z"); // Thursday, not a weekend/gajian/harbolnas window

function buildTenantRow(overrides: Partial<TenantRow> = {}): TenantRow {
  return {
    id: "t-1",
    tenant_id: "dss-motor",
    name: "DSS Motor",
    vertical: "AUTOMOTIVE",
    status: "ACTIVE",
    trial_ends_at: null,
    meta_access_token: null,
    meta_ad_account_id: null,
    meta_api_version: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const UNAVAILABLE_STRATEGY: CampaignStrategyResponseDto = {
  available: false,
  reason: "NO_API_KEY",
  message: "Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings",
};

function alwaysFailingFetch(): typeof fetch {
  return vi.fn(async () => new Response("", { status: 503 })) as unknown as typeof fetch;
}

function buildFakeMetaAdsConnector(): MetaAdsConnector {
  return {
    pullCampaignData: { execute: vi.fn(async () => ok({ campaigns: [] })) },
  } as unknown as MetaAdsConnector;
}

function buildService(
  overrides: {
    readonly tenant?: TenantRow;
    readonly leadStore?: LeadStore;
    readonly closingRepository?: IClosingRepository;
    readonly llmService?: LlmService;
    readonly listingRepository?: ListingRepository;
    readonly signalsRepository?: IntelligenceSignalsRepository;
    readonly competitorPageRepository?: CompetitorPageRepository;
    readonly capiConnector?: CapiConnector;
    readonly metaAdsConnector?: MetaAdsConnector;
  } = {},
): {
  readonly service: IntelligenceService;
  readonly llmService: LlmService;
  readonly signalsRepository: IntelligenceSignalsRepository;
  readonly tenantRepository: TenantRepository;
} {
  const config = buildTestConfig();
  const leadStore = (overrides.leadStore ??
    ({ getHotLeads: { execute: vi.fn(async () => ok([])) } } as unknown as LeadStore)) as LeadStore;
  const closingRepository = (overrides.closingRepository ??
    ({
      findByFilter: vi.fn(async () => ok([])),
    } as unknown as IClosingRepository)) as IClosingRepository;
  const llmService = (overrides.llmService ??
    ({
      campaignStrategy: vi.fn(async () => UNAVAILABLE_STRATEGY),
    } as unknown as LlmService)) as LlmService;
  const tenantRepository = {
    findByTenantId: vi.fn(async () => overrides.tenant ?? buildTenantRow()),
  } as unknown as TenantRepository;
  const listingRepository = (overrides.listingRepository ??
    ({ listByTenant: vi.fn(async () => []) } as unknown as ListingRepository)) as ListingRepository;
  const signalsRepository = (overrides.signalsRepository ??
    ({
      insert: vi.fn(async (values: Record<string, unknown>) => ({
        id: "row-1",
        generated_at: NOW.toISOString(),
        ...values,
      })),
      findLatestByTenant: vi.fn(async () => undefined),
    } as unknown as IntelligenceSignalsRepository)) as IntelligenceSignalsRepository;
  const competitorPageRepository = (overrides.competitorPageRepository ??
    ({
      listByTenant: vi.fn(async () => []),
      listActiveByTenantAndVertical: vi.fn(async () => []),
      insert: vi.fn(),
      findById: vi.fn(async () => undefined),
      deleteById: vi.fn(),
    } as unknown as CompetitorPageRepository)) as CompetitorPageRepository;
  const seasonalCalendarService = new SeasonalCalendarService();
  const trendsService = new GoogleTrendsService({ fetchImpl: alwaysFailingFetch() });
  const metaAdsConnector = overrides.metaAdsConnector ?? buildFakeMetaAdsConnector();
  const metaAdsConnectorRegistry = {
    resolve: vi.fn(async () =>
      ok({
        ...metaAdsConnector,
        accessToken: config.META_ACCESS_TOKEN,
        adAccountIds: config.META_AD_ACCOUNT_IDS,
      }),
    ),
  };

  const service = new IntelligenceService(
    config,
    leadStore,
    closingRepository,
    llmService,
    tenantRepository,
    listingRepository,
    signalsRepository,
    competitorPageRepository,
    seasonalCalendarService,
    trendsService,
    overrides.capiConnector,
    metaAdsConnectorRegistry as never,
    { upsertMany: async () => undefined, findTenantByAdMetaId: async () => undefined } as never,
    () => NOW,
    () => "test-correlation-id",
  );
  return { service, llmService, signalsRepository, tenantRepository };
}

describe("IntelligenceService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getLatest", () => {
    it("returns undefined when no row has ever been persisted for this tenant", async () => {
      const { service } = buildService();
      expect(await service.getLatest()).toBeUndefined();
    });

    it("returns the mapped latest row when one exists", async () => {
      const signalsRepository = {
        insert: vi.fn(),
        findLatestByTenant: vi.fn(async () => ({
          id: "row-1",
          tenant_id: "dss-motor",
          branch_id: null,
          seasonal_data: { isSpecialPeriod: false },
          trends_data: { available: false },
          competitor_data: { available: false },
          inventory_data: { available: false },
          lead_profile_data: { totalLeads: 0 },
          closing_data: { totalEvents: 0 },
          campaign_strategy: UNAVAILABLE_STRATEGY,
          digest_text: "digest",
          generated_at: NOW.toISOString(),
        })),
      } as unknown as IntelligenceSignalsRepository;
      const { service } = buildService({ signalsRepository });
      const latest = await service.getLatest();
      expect(latest?.id).toBe("row-1");
      expect(latest?.digestText).toBe("digest");
    });
  });

  describe("refresh", () => {
    it("throws NotFoundError when the tenant row doesn't exist", async () => {
      const { service, tenantRepository } = buildService();
      vi.mocked(tenantRepository.findByTenantId).mockResolvedValueOnce(undefined);
      await expect(service.refresh()).rejects.toThrow(NotFoundError);
    });

    it("AUTOMOTIVE: aggregates real signals, honestly defers inventory, and persists the result", async () => {
      const { service, llmService, signalsRepository } = buildService({
        tenant: buildTenantRow({ vertical: "AUTOMOTIVE" }),
      });
      const result = await service.refresh();

      expect(result.digestText).toContain("DSS Motor");
      expect(result.inventory).toMatchObject({ available: false });
      expect(vi.mocked(llmService.campaignStrategy)).toHaveBeenCalledTimes(1);
      const requestArg = vi.mocked(llmService.campaignStrategy).mock.calls[0]?.[0];
      expect(requestArg?.vertical).toBe("AUTOMOTIVE");
      expect(requestArg?.brandAngleIds).toContain("BRAND_TRUST");
      expect(requestArg?.productAngleValues).toContain("DP_RINGAN");
      expect(vi.mocked(signalsRepository.insert)).toHaveBeenCalledTimes(1);
    });

    it("PROPERTY: builds a real inventory signal from listingRepository rows", async () => {
      const rows: ListingRow[] = [
        {
          id: "l-1",
          tenant_id: "dss-motor",
          title: "Rumah Baru",
          property_type: "RUMAH",
          listing_status: "AKTIF",
          price: 500_000_000,
          branch_id: null,
          wa_number: null,
          land_area: null,
          build_area: null,
          bedrooms: null,
          bathrooms: null,
          garage: null,
          floors: null,
          certificate: null,
          condition: null,
          electricity: null,
          facing: null,
          address: null,
          city: null,
          province: null,
          postal_code: null,
          description: null,
          highlights: [],
          photos: [],
          main_photo_url: null,
          in_knowledge_base: false,
          created_at: NOW.toISOString(),
          updated_at: NOW.toISOString(),
        },
      ];
      const listingRepository = {
        listByTenant: vi.fn(async () => rows),
      } as unknown as ListingRepository;
      const { service } = buildService({
        tenant: buildTenantRow({ vertical: "PROPERTY" }),
        listingRepository,
      });
      const result = await service.refresh();
      expect(result.inventory).toMatchObject({ available: true, hasNewArrivals: true });
    });

    it("aggregates hot leads across every branch via LeadStore.getHotLeads", async () => {
      const execute = vi.fn(async (branchId: BranchId) =>
        branchId === BranchId.BINTARO
          ? ok([
              {
                score: 90,
                branchId: BranchId.BINTARO,
                createdAt: NOW,
                qualification: {
                  budget: false,
                  unit: false,
                  area: false,
                  payment: false,
                  timeline: false,
                  name: false,
                },
              } as unknown as Lead,
            ])
          : ok([]),
      );
      const leadStore = { getHotLeads: { execute } } as unknown as LeadStore;
      const { service } = buildService({ leadStore });
      const result = await service.refresh();
      expect(result.leadProfile).toMatchObject({ totalLeads: 1, avgScore: 90 });
    });

    it("capiHealth: honestly unavailable when CAPI_CONNECTOR is undefined (not configured)", async () => {
      const { service } = buildService({ capiConnector: undefined });
      const result = await service.refresh();
      expect(result.capiHealth).toEqual({
        available: false,
        reasoning: "CAPI_PIXEL_ID/CAPI_ACCESS_TOKEN belum dikonfigurasi.",
      });
    });

    it("capiHealth: real score/eventsReceived/capturedAt from a configured CapiConnector.getEmqScore", async () => {
      const capturedAt = new Date("2026-08-20T09:00:00.000Z");
      const capiConnector = {
        getEmqScore: {
          execute: vi.fn(async () =>
            ok({
              pixelId: "pixel-1",
              score: { value: 7.2 },
              eventsReceived: 12,
              capturedAt,
            }),
          ),
        },
      } as unknown as CapiConnector;
      const { service } = buildService({ capiConnector });
      const result = await service.refresh();
      expect(result.capiHealth).toEqual({
        available: true,
        pixelId: "pixel-1",
        score: 7.2,
        eventsReceived: 12,
        capturedAt: capturedAt.toISOString(),
        reasoning: "CAPI Event Match Quality score 7.2/10, 12 event diterima.",
      });
    });

    it("capiHealth: honestly degrades to available:false when getEmqScore fails", async () => {
      const capiConnector = {
        getEmqScore: {
          execute: vi.fn(async () => err(new Error("Meta API down"))),
        },
      } as unknown as CapiConnector;
      const { service } = buildService({ capiConnector });
      const result = await service.refresh();
      expect(result.capiHealth).toMatchObject({ available: false, reasoning: "Meta API down" });
    });

    it("anomalies: empty (but available:true) when no ad crosses the frequency threshold", async () => {
      const { service } = buildService();
      const result = await service.refresh();
      expect(result.anomalies).toMatchObject({ available: true, anomalies: [] });
    });

    it("anomalies: real FREQUENCY_HIGH signals from pulled AdMetrics.frequency across every configured ad account", async () => {
      const metaAdsConnector = {
        pullCampaignData: {
          execute: vi.fn(async () =>
            ok({
              campaigns: [
                {
                  adSets: [
                    {
                      ads: [
                        {
                          id: { toString: () => "ad-1" },
                          name: "Xpander Cinere",
                          metrics: { frequency: 5.5 },
                        },
                        {
                          id: { toString: () => "ad-2" },
                          name: "Brio Bintaro",
                          metrics: { frequency: 1.1 },
                        },
                      ],
                    },
                  ],
                },
              ],
            }),
          ),
        },
      } as unknown as MetaAdsConnector;
      const { service } = buildService({ metaAdsConnector });
      const result = await service.refresh();
      expect(result.anomalies).toMatchObject({
        available: true,
        anomalies: [{ adId: "ad-1", adName: "Xpander Cinere", severity: "HIGH" }],
      });
    });
  });

  describe("competitor pages CRUD", () => {
    it("deleteCompetitorPage throws NotFoundError for a missing id", async () => {
      const { service } = buildService();
      await expect(service.deleteCompetitorPage("missing")).rejects.toThrow(NotFoundError);
    });
  });
});

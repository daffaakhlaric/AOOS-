import { BranchId } from "@aos/branch-manager";
import { ok } from "@aos/common";
import { NotFoundError } from "@aos/errors";
import type { IClosingRepository, Lead, LeadStore } from "@aos/lead-store";
import { GoogleTrendsService, SeasonalCalendarService } from "@aos/meta-ads-agent";
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

function buildService(
  overrides: {
    readonly tenant?: TenantRow;
    readonly leadStore?: LeadStore;
    readonly closingRepository?: IClosingRepository;
    readonly llmService?: LlmService;
    readonly listingRepository?: ListingRepository;
    readonly signalsRepository?: IntelligenceSignalsRepository;
    readonly competitorPageRepository?: CompetitorPageRepository;
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
    () => NOW,
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
  });

  describe("competitor pages CRUD", () => {
    it("deleteCompetitorPage throws NotFoundError for a missing id", async () => {
      const { service } = buildService();
      await expect(service.deleteCompetitorPage("missing")).rejects.toThrow(NotFoundError);
    });
  });
});

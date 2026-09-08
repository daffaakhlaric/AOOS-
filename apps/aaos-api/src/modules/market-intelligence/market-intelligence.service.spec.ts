import { NotFoundError } from "@aos/errors";
import { GoogleTrendsService } from "@aos/meta-ads-agent";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildTestConfig } from "../../test-support/fixtures.js";
import type { CompetitorPageRepository } from "../intelligence/infrastructure/competitor-page.repository.js";
import type {
  TenantRepository,
  TenantRow,
} from "../superadmin/infrastructure/tenant.repository.js";

import type { MarketSignalsRepository } from "./infrastructure/market-signals.repository.js";
import { MarketIntelligenceService } from "./market-intelligence.service.js";

const NOW = new Date("2026-09-08T10:00:00.000Z"); // real "today" for this dispatch — musim sepi window

function buildTenantRow(overrides: Partial<TenantRow> = {}): TenantRow {
  return {
    id: "t-1",
    tenant_id: "dss-property",
    name: "DSS Property",
    vertical: "PROPERTY",
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

function alwaysFailingFetch(): typeof fetch {
  return vi.fn(async () => new Response("", { status: 503 })) as unknown as typeof fetch;
}

function buildService(
  overrides: {
    readonly tenant?: TenantRow;
    readonly config?: Partial<ReturnType<typeof buildTestConfig>>;
    readonly competitorPageRepository?: CompetitorPageRepository;
    readonly trendsService?: GoogleTrendsService;
    readonly signalsRepository?: MarketSignalsRepository;
  } = {},
): {
  readonly service: MarketIntelligenceService;
  readonly signalsRepository: MarketSignalsRepository;
  readonly tenantRepository: TenantRepository;
} {
  const config = buildTestConfig(overrides.config);
  const tenantRepository = {
    findByTenantId: vi.fn(async () => overrides.tenant ?? buildTenantRow()),
  } as unknown as TenantRepository;
  const signalsRepository =
    overrides.signalsRepository ??
    ({
      insert: vi.fn(async (values: Record<string, unknown>) => ({
        id: "mkt-row-1",
        generated_at: NOW.toISOString(),
        ...values,
      })),
      findLatestByTenant: vi.fn(async () => undefined),
    } as unknown as MarketSignalsRepository);
  const competitorPageRepository = (overrides.competitorPageRepository ??
    ({
      listActiveByTenantAndVertical: vi.fn(async () => []),
    } as unknown as CompetitorPageRepository)) as CompetitorPageRepository;
  const trendsService =
    overrides.trendsService ?? new GoogleTrendsService({ fetchImpl: alwaysFailingFetch() });

  const service = new MarketIntelligenceService(
    config,
    tenantRepository,
    signalsRepository,
    competitorPageRepository,
    trendsService,
    () => NOW,
  );
  return { service, signalsRepository, tenantRepository };
}

describe("MarketIntelligenceService", () => {
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
          id: "mkt-row-1",
          tenant_id: "dss-property",
          vertical: "PROPERTY",
          search_trend_data: { available: false, reason: "circuit breaker terbuka" },
          competitor_data: { available: false, reason: "unconfigured" },
          kpr_rate_data: { available: false, reason: "unconfigured" },
          seasonal_data: { available: true, status: "musim sepi", note: "n" },
          digest_text: "digest",
          generated_at: NOW.toISOString(),
        })),
      } as unknown as MarketSignalsRepository;
      const { service } = buildService({ signalsRepository });
      const result = await service.getLatest();
      expect(result?.id).toBe("mkt-row-1");
      expect(result?.seasonality.status).toBe("musim sepi");
    });
  });

  describe("refresh", () => {
    it("throws NotFoundError when the tenant row doesn't exist", async () => {
      const { service, tenantRepository } = buildService();
      vi.mocked(tenantRepository.findByTenantId).mockResolvedValueOnce(undefined);
      await expect(service.refresh()).rejects.toThrow(NotFoundError);
    });

    it("seasonality is always available: true (real, static, zero external dependency)", async () => {
      const { service } = buildService();
      const result = await service.refresh();
      expect(result.seasonality.available).toBe(true);
      expect(result.seasonality.status).toBe("musim sepi");
    });

    it("searchTrend honestly degrades when Google Trends' circuit breaker is open, never throwing", async () => {
      const trendsService = new GoogleTrendsService({
        fetchImpl: alwaysFailingFetch(),
        circuitBreakerThreshold: 1,
      });
      // Trip the breaker with one real failed call before refresh() runs.
      await trendsService.getTrends("PROPERTY", "UMUM" as never);
      const { service } = buildService({ trendsService });
      const result = await service.refresh();
      expect(result.searchTrend).toMatchObject({ available: false });
      expect((result.searchTrend as { reason: string }).reason).toContain("circuit breaker");
    });

    it("competitorAngleTrend honestly degrades when META_APP_ID/META_APP_SECRET aren't configured", async () => {
      const { service } = buildService({ config: { META_APP_ID: "", META_APP_SECRET: "" } });
      const result = await service.refresh();
      expect(result.competitorAngleTrend).toMatchObject({ available: false });
      expect((result.competitorAngleTrend as { reason: string }).reason).toContain("META_APP_ID");
    });

    it("competitorAngleTrend honestly degrades when the tenant has no active competitor pages for this vertical", async () => {
      const { service } = buildService({
        config: { META_APP_ID: "app-id", META_APP_SECRET: "app-secret" },
      });
      const result = await service.refresh();
      expect(result.competitorAngleTrend).toMatchObject({ available: false });
      expect((result.competitorAngleTrend as { reason: string }).reason).toContain("kompetitor");
    });

    it("kprRate honestly degrades when MARKET_INTEL_KPR_RATE_PCT is unset", async () => {
      const { service } = buildService();
      const result = await service.refresh();
      expect(result.kprRate).toMatchObject({ available: false });
      expect((result.kprRate as { reason: string }).reason).toContain("MARKET_INTEL_KPR_RATE_PCT");
    });

    it("kprRate is real/available when an operator has curated the 3 env vars", async () => {
      const { service } = buildService({
        config: {
          MARKET_INTEL_KPR_RATE_PCT: "6.25",
          MARKET_INTEL_KPR_RATE_DIRECTION: "TURUN",
          MARKET_INTEL_KPR_RATE_AS_OF: "2026-09-01",
        },
      });
      const result = await service.refresh();
      expect(result.kprRate).toMatchObject({
        available: true,
        currentPct: 6.25,
        direction: "TURUN",
        asOf: "2026-09-01",
      });
    });

    it("kprRate honestly degrades when the configured value isn't a real number", async () => {
      const { service } = buildService({
        config: { MARKET_INTEL_KPR_RATE_PCT: "not-a-number" },
      });
      const result = await service.refresh();
      expect(result.kprRate).toMatchObject({ available: false });
    });

    it("one source failing never aborts the whole refresh — every other source still populates", async () => {
      const { service, signalsRepository } = buildService();
      const result = await service.refresh();
      // searchTrend degraded (no real network), competitorAngleTrend degraded (unconfigured),
      // kprRate degraded (unconfigured) — but the row still persists with a real digest and a
      // real, always-available seasonality signal, never a thrown error.
      expect(result.seasonality.available).toBe(true);
      expect(vi.mocked(signalsRepository.insert)).toHaveBeenCalledTimes(1);
      expect(result.digestText).toContain("Sinyal Pasar");
    });

    it("persists tenant_id/vertical from the real tenant row, not a hardcoded default", async () => {
      const { service, signalsRepository } = buildService({
        tenant: buildTenantRow({ tenant_id: "another-tenant", vertical: "AUTOMOTIVE" }),
        config: { AAOS_TENANT_ID: "another-tenant" },
      });
      await service.refresh();
      const insertArg = vi.mocked(signalsRepository.insert).mock.calls[0]?.[0];
      expect(insertArg?.tenant_id).toBe("another-tenant");
      expect(insertArg?.vertical).toBe("AUTOMOTIVE");
    });
  });
});

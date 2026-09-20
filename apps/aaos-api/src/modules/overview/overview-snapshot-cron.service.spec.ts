import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import type { LeadResponseDto } from "../leads/dto/lead-response.dto.js";
import type { LeadsService } from "../leads/leads.service.js";
import type { MetaAdsService } from "../meta-ads/meta-ads.service.js";
import type {
  TenantRepository,
  TenantRow,
} from "../superadmin/infrastructure/tenant.repository.js";

import type { OverviewSnapshotRepository } from "./infrastructure/overview-snapshot.repository.js";
import { OverviewSnapshotCronService } from "./overview-snapshot-cron.service.js";

function buildTenant(overrides: Partial<TenantRow>): TenantRow {
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
    mode: "LIVE",
    mode_changed_at: null,
    mode_changed_by: null,
    operating_mode: "FULL_CONTROL",
    operating_mode_changed_at: null,
    operating_mode_changed_by: null,
    meta_access_token_encrypted: null,
    meta_token_expires_at: null,
    meta_connection_source: "manual",
    meta_fb_user_id: null,
    meta_fb_user_name: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function buildLead(overrides: Partial<LeadResponseDto> = {}): LeadResponseDto {
  return {
    id: "lead-1",
    tenantId: "dss-motor",
    leadSource: "META_ADS",
    leadPhone: "628111111111",
    branchId: "BINTARO",
    wabaPhoneNumberId: "waba-1",
    status: "HOT",
    score: 80,
    temperature: "HOT",
    qualification: {} as LeadResponseDto["qualification"],
    createdAt: "2026-01-10T00:00:00.000Z",
    updatedAt: "2026-01-15T00:00:00.000Z",
    ...overrides,
  };
}

function buildAccountDto(campaigns: ReadonlyArray<{ spend: number }>) {
  return {
    id: "act_1",
    name: "Test Account",
    businessManagerId: "bm-1",
    currency: "IDR",
    timezone: "Asia/Jakarta",
    syncedAt: "2026-01-15T00:00:00.000Z",
    campaigns: campaigns.map((c, i) => ({
      id: `c-${i}`,
      stableId: `c-${i}`,
      metaId: `m-${i}`,
      name: `Campaign ${i}`,
      objective: "OUTCOME_LEADS",
      status: "ACTIVE",
      funnel: "MAAO2",
      branch: "BINTARO",
      spend: c.spend,
      createdAt: "2026-01-01T00:00:00.000Z",
      adSets: [],
    })),
  };
}

describe("OverviewSnapshotCronService.runDailySnapshotSweep", () => {
  it("upserts one real snapshot row per tenant using the SAME MetaAdsService/LeadsService methods OverviewService reuses", async () => {
    const tenants = {
      list: vi.fn(async () => [buildTenant({ tenant_id: "dss-motor" })]),
    } as unknown as TenantRepository;
    const getAdAccounts = vi.fn(async () => [{ id: "act_1", name: "Test Account" }]);
    const pullCampaigns = vi.fn(async () =>
      buildAccountDto([{ spend: 500_000 }, { spend: 250_000 }]),
    );
    const metaAdsService = { getAdAccounts, pullCampaigns } as unknown as MetaAdsService;
    const getLeadsByBranch = vi.fn(async () => [buildLead(), buildLead({ id: "lead-2" })]);
    const leadsService = { getLeadsByBranch } as unknown as LeadsService;
    const upsert = vi.fn(async () => undefined);
    const repository = { upsert } as unknown as OverviewSnapshotRepository;

    const cron = new OverviewSnapshotCronService(tenants, metaAdsService, leadsService, repository);
    await cron.runDailySnapshotSweep();

    expect(upsert).toHaveBeenCalledTimes(1);
    const [tenantId, date, totalSpend, totalLeads] = upsert.mock.calls[0] as [
      string,
      string,
      number,
      number,
    ];
    expect(tenantId).toBe("dss-motor");
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(totalSpend).toBe(750_000);
    // getLeadsByBranch is called once per real branch (ALL_BRANCH_IDS fan-out) and this fake
    // returns the same 2 leads for every branch — this only asserts the real multiplication
    // shape (branches * 2), matching OverviewService.getLeadsSummary's own established test
    // convention (see that file's own "per-branch-call multiples" comment).
    expect(totalLeads).toBeGreaterThan(0);
    expect(totalLeads % 2).toBe(0);
  });

  it("isolates one tenant's Meta pull failure — continues the sweep for the rest", async () => {
    const tenants = {
      list: vi.fn(async () => [buildTenant({ tenant_id: "a" }), buildTenant({ tenant_id: "b" })]),
    } as unknown as TenantRepository;
    const getAdAccounts = vi.fn(async (tenantId: string) => {
      if (tenantId === "a") {
        throw new Error("Meta pull failed: connector unavailable");
      }
      return [{ id: "act_1", name: "Test Account" }];
    });
    const pullCampaigns = vi.fn(async () => buildAccountDto([{ spend: 100_000 }]));
    const metaAdsService = { getAdAccounts, pullCampaigns } as unknown as MetaAdsService;
    const leadsService = {
      getLeadsByBranch: vi.fn(async () => []),
    } as unknown as LeadsService;
    const upsert = vi.fn(async () => undefined);
    const repository = { upsert } as unknown as OverviewSnapshotRepository;

    const cron = new OverviewSnapshotCronService(tenants, metaAdsService, leadsService, repository);
    await expect(cron.runDailySnapshotSweep()).resolves.toBeUndefined();

    // Tenant "a" failed and is never written; tenant "b" still gets its real row.
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith("b", expect.any(String), 100_000, 0);
  });

  it("never throws when TenantRepository.list itself fails — skips the sweep entirely", async () => {
    const tenants = {
      list: vi.fn(async () => {
        throw new Error("db down");
      }),
    } as unknown as TenantRepository;
    const metaAdsService = {
      getAdAccounts: vi.fn(),
      pullCampaigns: vi.fn(),
    } as unknown as MetaAdsService;
    const leadsService = { getLeadsByBranch: vi.fn() } as unknown as LeadsService;
    const upsert = vi.fn();
    const repository = { upsert } as unknown as OverviewSnapshotRepository;

    const cron = new OverviewSnapshotCronService(tenants, metaAdsService, leadsService, repository);
    await expect(cron.runDailySnapshotSweep()).resolves.toBeUndefined();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("is idempotent at the repository boundary — a second run for the same day calls upsert again with the same conflict key (repository owns dedup, see OverviewSnapshotRepository's own spec)", async () => {
    const tenants = {
      list: vi.fn(async () => [buildTenant({ tenant_id: "dss-motor" })]),
    } as unknown as TenantRepository;
    const metaAdsService = {
      getAdAccounts: vi.fn(async () => [{ id: "act_1", name: "Test Account" }]),
      pullCampaigns: vi.fn(async () => buildAccountDto([{ spend: 100_000 }])),
    } as unknown as MetaAdsService;
    const leadsService = { getLeadsByBranch: vi.fn(async () => []) } as unknown as LeadsService;
    const upsert = vi.fn(async () => undefined);
    const repository = { upsert } as unknown as OverviewSnapshotRepository;

    const cron = new OverviewSnapshotCronService(tenants, metaAdsService, leadsService, repository);
    await cron.runDailySnapshotSweep();
    await cron.runDailySnapshotSweep();

    expect(upsert).toHaveBeenCalledTimes(2);
    const firstDate = (upsert.mock.calls[0] as [string, string, number, number])[1];
    const secondDate = (upsert.mock.calls[1] as [string, string, number, number])[1];
    expect(firstDate).toBe(secondDate);
  });
});

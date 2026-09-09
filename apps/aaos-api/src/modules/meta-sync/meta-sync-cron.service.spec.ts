import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import type {
  TenantRepository,
  TenantRow,
} from "../superadmin/infrastructure/tenant.repository.js";

import { MetaSyncCronService } from "./meta-sync-cron.service.js";
import type { MetaSyncService } from "./meta-sync.service.js";

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

describe("MetaSyncCronService.runPeriodicInsightsSync", () => {
  it("calls syncAllCampaignInsights for every tenant", async () => {
    const tenants = {
      list: vi.fn(async () => [buildTenant({ tenant_id: "a" }), buildTenant({ tenant_id: "b" })]),
    } as unknown as TenantRepository;
    const metaSync = {
      syncAllCampaignInsights: vi.fn(async () => undefined),
    } as unknown as MetaSyncService;
    const cron = new MetaSyncCronService(tenants, metaSync);

    await cron.runPeriodicInsightsSync();

    expect(metaSync.syncAllCampaignInsights).toHaveBeenCalledTimes(2);
    expect(metaSync.syncAllCampaignInsights).toHaveBeenCalledWith("a");
    expect(metaSync.syncAllCampaignInsights).toHaveBeenCalledWith("b");
  });

  it("isolates one tenant's failure — continues the sweep for the rest", async () => {
    const tenants = {
      list: vi.fn(async () => [buildTenant({ tenant_id: "a" }), buildTenant({ tenant_id: "b" })]),
    } as unknown as TenantRepository;
    const metaSync = {
      syncAllCampaignInsights: vi.fn(async (tenantId: string) => {
        if (tenantId === "a") {
          throw new Error("meta rate limited");
        }
        return undefined;
      }),
    } as unknown as MetaSyncService;
    const cron = new MetaSyncCronService(tenants, metaSync);

    await expect(cron.runPeriodicInsightsSync()).resolves.toBeUndefined();
    expect(metaSync.syncAllCampaignInsights).toHaveBeenCalledTimes(2);
  });

  it("never throws when TenantRepository.list itself fails", async () => {
    const tenants = {
      list: vi.fn(async () => {
        throw new Error("db down");
      }),
    } as unknown as TenantRepository;
    const metaSync = { syncAllCampaignInsights: vi.fn() } as unknown as MetaSyncService;
    const cron = new MetaSyncCronService(tenants, metaSync);

    await expect(cron.runPeriodicInsightsSync()).resolves.toBeUndefined();
    expect(metaSync.syncAllCampaignInsights).not.toHaveBeenCalled();
  });
});

describe("MetaSyncCronService.runDailySnapshot", () => {
  it("calls saveDailySnapshot for every tenant, isolating per-tenant failures", async () => {
    const tenants = {
      list: vi.fn(async () => [buildTenant({ tenant_id: "a" }), buildTenant({ tenant_id: "b" })]),
    } as unknown as TenantRepository;
    const metaSync = {
      saveDailySnapshot: vi.fn(async (tenantId: string) => {
        if (tenantId === "a") {
          throw new Error("unexpected");
        }
        return undefined;
      }),
    } as unknown as MetaSyncService;
    const cron = new MetaSyncCronService(tenants, metaSync);

    await expect(cron.runDailySnapshot()).resolves.toBeUndefined();
    expect(metaSync.saveDailySnapshot).toHaveBeenCalledTimes(2);
  });
});

import "reflect-metadata";

import { ok, err } from "@aos/common";
import { UnavailableError } from "@aos/errors";
import { describe, expect, it, vi } from "vitest";

import type {
  TenantRepository,
  TenantRow,
} from "../superadmin/infrastructure/tenant.repository.js";

import { MetaOAuthRefreshCronService } from "./meta-oauth-refresh-cron.service.js";
import type { MetaOAuthService } from "./meta-oauth.service.js";

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

describe("MetaOAuthRefreshCronService.runDailyRefreshSweep", () => {
  it("only calls refreshTokenIfNeeded for OAuth-connected tenants, skipping manual ones", async () => {
    const tenants = {
      list: vi.fn(async () => [
        buildTenant({ tenant_id: "oauth-tenant", meta_connection_source: "oauth" }),
        buildTenant({ tenant_id: "manual-tenant", meta_connection_source: "manual" }),
      ]),
    } as unknown as TenantRepository;
    const metaOAuth = {
      refreshTokenIfNeeded: vi.fn(async () => ok({ refreshed: true })),
    } as unknown as MetaOAuthService;
    const cron = new MetaOAuthRefreshCronService(tenants, metaOAuth);

    await cron.runDailyRefreshSweep();

    expect(metaOAuth.refreshTokenIfNeeded).toHaveBeenCalledTimes(1);
    expect(metaOAuth.refreshTokenIfNeeded).toHaveBeenCalledWith("oauth-tenant");
  });

  it("isolates one tenant's failure — continues the sweep for the rest", async () => {
    const tenants = {
      list: vi.fn(async () => [
        buildTenant({ tenant_id: "a", meta_connection_source: "oauth" }),
        buildTenant({ tenant_id: "b", meta_connection_source: "oauth" }),
      ]),
    } as unknown as TenantRepository;
    const metaOAuth = {
      refreshTokenIfNeeded: vi.fn(async (tenantId: string) => {
        if (tenantId === "a") {
          throw new Error("unexpected");
        }
        return ok({ refreshed: false });
      }),
    } as unknown as MetaOAuthService;
    const cron = new MetaOAuthRefreshCronService(tenants, metaOAuth);

    await expect(cron.runDailyRefreshSweep()).resolves.toBeUndefined();
    expect(metaOAuth.refreshTokenIfNeeded).toHaveBeenCalledTimes(2);
  });

  it("never throws when TenantRepository.list itself fails", async () => {
    const tenants = {
      list: vi.fn(async () => {
        throw new Error("db down");
      }),
    } as unknown as TenantRepository;
    const metaOAuth = { refreshTokenIfNeeded: vi.fn() } as unknown as MetaOAuthService;
    const cron = new MetaOAuthRefreshCronService(tenants, metaOAuth);

    await expect(cron.runDailyRefreshSweep()).resolves.toBeUndefined();
    expect(metaOAuth.refreshTokenIfNeeded).not.toHaveBeenCalled();
  });

  it("handles a real Result.err from refreshTokenIfNeeded without throwing", async () => {
    const tenants = {
      list: vi.fn(async () => [buildTenant({ tenant_id: "a", meta_connection_source: "oauth" })]),
    } as unknown as TenantRepository;
    const metaOAuth = {
      refreshTokenIfNeeded: vi.fn(async () => err(new UnavailableError("refresh failed"))),
    } as unknown as MetaOAuthService;
    const cron = new MetaOAuthRefreshCronService(tenants, metaOAuth);
    await expect(cron.runDailyRefreshSweep()).resolves.toBeUndefined();
  });
});

import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { EncryptionService } from "../../common/encryption.service.js";
import {
  createFakeSupabaseClient,
  type FakeSupabaseClient,
} from "../../test-support/fake-supabase-client.js";
import { buildTestConfig } from "../../test-support/fixtures.js";
import { MetaOAuthConfigService } from "../meta-oauth-config/meta-oauth-config.service.js";
import { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";

import { OAuthStateRepository } from "./infrastructure/oauth-state.repository.js";
import { TokenRefreshLogRepository } from "./infrastructure/token-refresh-log.repository.js";
import { MetaAdsOAuthClient } from "./meta-ads-oauth-client.js";
import { MetaOAuthService } from "./meta-oauth.service.js";

const NOW_ISO = "2026-09-09T10:00:00.000Z";
const TEST_KEY = "0123456789abcdef".repeat(4);

const CONFIG = buildTestConfig({
  AAOS_API_BASE_URL: "https://api.example.com",
  META_APP_ID: "APP_ID",
  META_APP_SECRET: "APP_SECRET",
  META_API_VERSION: "v21.0",
});

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

function seedTenant(client: FakeSupabaseClient, overrides: Record<string, unknown> = {}): void {
  client.seed("tenants", {
    id: "t-1",
    tenant_id: "dss-motor",
    name: "DSS Motor",
    vertical: "AUTOMOTIVE",
    status: "ACTIVE",
    trial_ends_at: null,
    meta_access_token: null,
    meta_credential_version: 1,
    meta_ad_account_id: null,
    meta_api_version: "v21.0",
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
  });
}

function buildHarness(
  options: { readonly fetchImpl?: typeof fetch; readonly now?: () => Date } = {},
) {
  const client = createFakeSupabaseClient();
  const tenants = new TenantRepository(client);
  const oauthStates = new OAuthStateRepository(client);
  const tokenRefreshLog = new TokenRefreshLogRepository(client);
  const encryption = new EncryptionService({ TOKEN_ENCRYPTION_KEY: TEST_KEY });
  const metaOAuthConfig = new MetaOAuthConfigService(
    { get: vi.fn(async () => undefined), upsert: vi.fn() } as never,
    encryption,
    CONFIG,
  );
  const now = options.now ?? (() => new Date(NOW_ISO));
  const metaClient =
    options.fetchImpl !== undefined
      ? new MetaAdsOAuthClient({
          appId: CONFIG.META_APP_ID,
          appSecret: CONFIG.META_APP_SECRET,
          apiVersion: CONFIG.META_API_VERSION,
          fetchImpl: options.fetchImpl,
        })
      : undefined;
  const service = new MetaOAuthService(
    CONFIG,
    metaOAuthConfig,
    encryption,
    tenants,
    oauthStates,
    tokenRefreshLog,
    metaClient,
    now,
  );
  return { service, client, tenants, oauthStates, tokenRefreshLog, encryption, now };
}

function buildHappyPathFetch(adAccountCount: 0 | 1 | 2 = 1): typeof fetch {
  return vi.fn(async (url: string | URL) => {
    const u = new URL(url.toString());
    if (u.pathname.endsWith("/oauth/access_token") && u.searchParams.get("grant_type") === null) {
      return jsonResponse({ access_token: "SHORT_LIVED", expires_in: 5400 });
    }
    if (u.searchParams.get("grant_type") === "fb_exchange_token") {
      return jsonResponse({ access_token: "LONG_LIVED", expires_in: 5183944 });
    }
    if (u.pathname.endsWith("/me")) {
      return jsonResponse({ id: "1000", name: "Budi Santoso" });
    }
    if (u.pathname.endsWith("/me/adaccounts")) {
      const accounts =
        adAccountCount === 0
          ? []
          : adAccountCount === 1
            ? [{ id: "act_111", account_id: "111", name: "DSS Motor Ads" }]
            : [
                { id: "act_111", account_id: "111", name: "A" },
                { id: "act_222", account_id: "222", name: "B" },
              ];
      return jsonResponse({ data: accounts });
    }
    throw new Error(`unexpected URL in test: ${u.toString()}`);
  }) as unknown as typeof fetch;
}

describe("MetaOAuthService.generateOAuthUrl", () => {
  it("persists a real, non-expired oauth_states row and returns a valid Meta authorize URL", async () => {
    const { service, oauthStates } = buildHarness();
    const result = await service.generateOAuthUrl("dss-motor");
    const url = new URL(result.authorizeUrl);
    expect(url.hostname).toBe("www.facebook.com");
    expect(url.searchParams.get("state")).toBeTruthy();

    const state = url.searchParams.get("state") as string;
    const row = await oauthStates.consume(state, new Date(NOW_ISO));
    expect(row?.tenant_id).toBe("dss-motor");
  });

  it("throws UnavailableError when Meta App credentials are unset", async () => {
    const { service } = buildHarnessWithUnconfiguredApp();
    await expect(service.generateOAuthUrl("dss-motor")).rejects.toThrow();
  });
});

function buildHarnessWithUnconfiguredApp() {
  const client = createFakeSupabaseClient();
  const tenants = new TenantRepository(client);
  const oauthStates = new OAuthStateRepository(client);
  const tokenRefreshLog = new TokenRefreshLogRepository(client);
  const encryption = new EncryptionService({ TOKEN_ENCRYPTION_KEY: TEST_KEY });
  const unconfigured = buildTestConfig({
    META_APP_ID: "",
    META_APP_SECRET: "",
    AAOS_API_BASE_URL: "https://api.example.com",
  });
  const metaOAuthConfig = new MetaOAuthConfigService(
    { get: vi.fn(async () => undefined), upsert: vi.fn() } as never,
    encryption,
    unconfigured,
  );
  const service = new MetaOAuthService(
    unconfigured,
    metaOAuthConfig,
    encryption,
    tenants,
    oauthStates,
    tokenRefreshLog,
    undefined,
    () => new Date(NOW_ISO),
  );
  return { service };
}

describe("MetaOAuthService.handleCallback", () => {
  it("succeeds: exchanges code -> long-lived token, persists encrypted onto tenants, requires explicit selection even for one ad account", async () => {
    const { service, client, tenants } = buildHarness({ fetchImpl: buildHappyPathFetch(1) });
    seedTenant(client);
    const { authorizeUrl } = await service.generateOAuthUrl("dss-motor");
    const state = new URL(authorizeUrl).searchParams.get("state") as string;

    const result = await service.handleCallback("real-code", state, undefined);
    expect(result.success).toBe(true);

    const tenant = await tenants.findByTenantId("dss-motor");
    expect(tenant?.meta_connection_source).toBe("oauth");
    expect(tenant?.meta_fb_user_id).toBe("1000");
    expect(tenant?.meta_ad_account_id).toBeNull();
    expect(tenant?.meta_access_token_encrypted).not.toBe("LONG_LIVED");
    expect(tenant?.meta_access_token_encrypted).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]*$/);
  });

  it("does NOT auto-select an ad account when more than one is returned", async () => {
    const { service, client, tenants } = buildHarness({ fetchImpl: buildHappyPathFetch(2) });
    seedTenant(client);
    const { authorizeUrl } = await service.generateOAuthUrl("dss-motor");
    const state = new URL(authorizeUrl).searchParams.get("state") as string;

    await service.handleCallback("real-code", state, undefined);
    const tenant = await tenants.findByTenantId("dss-motor");
    expect(tenant?.meta_ad_account_id).toBeNull();
  });

  it("fails honestly when Meta denies consent (error param present)", async () => {
    const { service } = buildHarness();
    const result = await service.handleCallback(undefined, undefined, "access_denied");
    expect(result.success).toBe(false);
    expect(result.message).toContain("access_denied");
  });

  it("fails honestly on an invalid/unknown state", async () => {
    const { service } = buildHarness({ fetchImpl: buildHappyPathFetch(1) });
    const result = await service.handleCallback("code", "unknown-state", undefined);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/state/i);
  });

  it("fails honestly on a REPLAYED state (single-use)", async () => {
    const { service, client } = buildHarness({ fetchImpl: buildHappyPathFetch(1) });
    seedTenant(client);
    const { authorizeUrl } = await service.generateOAuthUrl("dss-motor");
    const state = new URL(authorizeUrl).searchParams.get("state") as string;

    const first = await service.handleCallback("code", state, undefined);
    expect(first.success).toBe(true);
    const replay = await service.handleCallback("code", state, undefined);
    expect(replay.success).toBe(false);
  });

  it("fails honestly when Meta's code exchange returns an error", async () => {
    const failingFetch = vi.fn(async () =>
      jsonResponse({ error: { message: "Invalid verification code format." } }, { status: 400 }),
    ) as unknown as typeof fetch;
    const { service, client } = buildHarness({ fetchImpl: failingFetch });
    seedTenant(client);
    const { authorizeUrl } = await service.generateOAuthUrl("dss-motor");
    const state = new URL(authorizeUrl).searchParams.get("state") as string;

    const result = await service.handleCallback("bad-code", state, undefined);
    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid verification code format.");
  });

  it("fails honestly on a malformed Meta API response shape", async () => {
    const malformedFetch = vi.fn(async () =>
      jsonResponse({ nonsense: true }),
    ) as unknown as typeof fetch;
    const { service, client } = buildHarness({ fetchImpl: malformedFetch });
    seedTenant(client);
    const { authorizeUrl } = await service.generateOAuthUrl("dss-motor");
    const state = new URL(authorizeUrl).searchParams.get("state") as string;

    const result = await service.handleCallback("code", state, undefined);
    expect(result.success).toBe(false);
  });
});

describe("MetaOAuthService.getToken", () => {
  it("decrypts and returns the stored token (round-trip)", async () => {
    const { service, client, encryption } = buildHarness();
    seedTenant(client, {
      meta_connection_source: "oauth",
      meta_access_token_encrypted: encryption.encrypt("REAL_TOKEN"),
      meta_token_expires_at: "2026-12-31T00:00:00.000Z", // far future — refreshTokenIfNeeded is a no-op
    });
    const token = await service.getToken("dss-motor");
    expect(token).toBe("REAL_TOKEN");
  });

  it("throws UnavailableError when the tenant has no OAuth token", async () => {
    const { service, client } = buildHarness();
    seedTenant(client);
    await expect(service.getToken("dss-motor")).rejects.toThrow();
  });
});

describe("MetaOAuthService.refreshTokenIfNeeded", () => {
  it("cannot restore credentials after a concurrent disconnect", async () => {
    let duringRefresh: () => Promise<void> = async () => {};
    const refreshFetch = vi.fn(async () => {
      await duringRefresh();
      return jsonResponse({ access_token: "LATE_TOKEN", expires_in: 5183944 });
    }) as unknown as typeof fetch;
    const { service, client, encryption, tenants } = buildHarness({ fetchImpl: refreshFetch });
    seedTenant(client, {
      meta_connection_source: "oauth",
      meta_access_token_encrypted: encryption.encrypt("OLD_TOKEN"),
      meta_token_expires_at: "2026-09-14T10:00:00.000Z",
    });
    duringRefresh = async () => {
      // Model the database trigger's version advance when a disconnect wins.
      await tenants.updateByTenantId("dss-motor", {
        meta_credential_version: 2,
        meta_access_token_encrypted: null,
        meta_integration_status: "DISCONNECTED",
      });
    };
    await expect(service.refreshTokenIfNeeded("dss-motor")).rejects.toThrow("Integration changed");
    expect((await tenants.findByTenantId("dss-motor"))?.meta_access_token_encrypted).toBeNull();
    expect(client.rows("token_refresh_log").some((row) => row["success"] === true)).toBe(false);
  });
  it("is a no-op for a tenant that is not OAuth-connected", async () => {
    const { service, client } = buildHarness();
    seedTenant(client, { meta_connection_source: "manual" });
    const result = await service.refreshTokenIfNeeded("dss-motor");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.refreshed).toBe(false);
    }
  });

  it("is a no-op when the token is not within the 10-day refresh threshold", async () => {
    const { service, client, encryption } = buildHarness();
    seedTenant(client, {
      meta_connection_source: "oauth",
      meta_access_token_encrypted: encryption.encrypt("TOKEN"),
      // 20 days from NOW_ISO — outside the 10-day threshold.
      meta_token_expires_at: "2026-09-29T10:00:00.000Z",
    });
    const result = await service.refreshTokenIfNeeded("dss-motor");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.refreshed).toBe(false);
    }
  });

  it("refreshes when within the 10-day threshold and writes a success token_refresh_log row", async () => {
    const refreshFetch = vi.fn(async () =>
      jsonResponse({ access_token: "NEW_LONG_LIVED", expires_in: 5183944 }),
    ) as unknown as typeof fetch;
    const { service, client, encryption } = buildHarness({ fetchImpl: refreshFetch });
    seedTenant(client, {
      meta_connection_source: "oauth",
      meta_access_token_encrypted: encryption.encrypt("OLD_TOKEN"),
      // 5 days from NOW_ISO — inside the 10-day threshold.
      meta_token_expires_at: "2026-09-14T10:00:00.000Z",
    });
    const result = await service.refreshTokenIfNeeded("dss-motor");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.refreshed).toBe(true);
    }
    expect(client.rows("token_refresh_log")).toHaveLength(1);
    expect(client.rows("token_refresh_log")[0]?.["success"]).toBe(true);
  });

  it("writes a FAILURE token_refresh_log row and returns err when Meta's refresh call fails, keeping the old token", async () => {
    const failingFetch = vi.fn(async () =>
      jsonResponse({ error: { message: "Token has expired." } }, { status: 400 }),
    ) as unknown as typeof fetch;
    const { service, client, encryption, tenants } = buildHarness({ fetchImpl: failingFetch });
    const oldEncrypted = encryption.encrypt("OLD_TOKEN");
    seedTenant(client, {
      meta_connection_source: "oauth",
      meta_access_token_encrypted: oldEncrypted,
      meta_token_expires_at: "2026-09-14T10:00:00.000Z",
    });
    const result = await service.refreshTokenIfNeeded("dss-motor");
    expect(result.ok).toBe(false);

    expect(client.rows("token_refresh_log")).toHaveLength(1);
    expect(client.rows("token_refresh_log")[0]?.["success"]).toBe(false);

    const tenant = await tenants.findByTenantId("dss-motor");
    expect(tenant?.meta_access_token_encrypted).toBe(oldEncrypted);
  });
});

describe("MetaOAuthService.disconnect", () => {
  it("clears all credentials and destinations on disconnect", async () => {
    const { service, client, tenants, encryption } = buildHarness();
    seedTenant(client, {
      meta_access_token: "manual-plain-token-should-survive",
      meta_connection_source: "oauth",
      meta_access_token_encrypted: encryption.encrypt("OAUTH_TOKEN"),
      meta_token_expires_at: "2026-12-31T00:00:00.000Z",
      meta_fb_user_id: "1000",
      meta_fb_user_name: "Budi Santoso",
    });

    await service.disconnect("dss-motor");

    const tenant = await tenants.findByTenantId("dss-motor");
    expect(tenant?.meta_connection_source).toBe("manual");
    expect(tenant?.meta_access_token_encrypted).toBeNull();
    expect(tenant?.meta_token_expires_at).toBeNull();
    expect(tenant?.meta_fb_user_id).toBeNull();
    expect(tenant?.meta_fb_user_name).toBeNull();
    // Legacy credentials cannot survive disconnect.
    expect(tenant?.meta_access_token).toBeNull();
    expect(tenant?.meta_ad_account_id).toBeNull();
    expect(tenant?.meta_page_id).toBeNull();
    expect(tenant?.meta_integration_status).toBe("DISCONNECTED");
  });
});

import { MetaAdsConnectorFactory, type MetaAdsConnector } from "@aos/meta-ads-connector";
import { describe, expect, it, vi } from "vitest";

import { toConnectorConfig } from "../../../config/to-connector-config.js";
import { createFakePublisher } from "../../../test-support/fake-publisher.js";
import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";
import { buildTestConfig } from "../../../test-support/fixtures.js";
import { TenantRepository } from "../../superadmin/infrastructure/tenant.repository.js";
import type { WebhookSecretsService } from "../../webhook-config/webhook-secrets.service.js";

import {
  ConnectorNotConfiguredError,
  MetaAdsConnectorRegistry,
} from "./meta-ads-connector-registry.js";

function buildFakeWebhookSecrets(): WebhookSecretsService {
  return {
    getMetaSecrets: vi.fn(async () => ({
      verifyToken: "test-verify-token",
      appSecret: "test-app-secret",
    })),
    getWhatsappSecrets: vi.fn(async () => ({
      verifyToken: "test-whatsapp-verify-token",
      appSecret: "test-whatsapp-app-secret",
    })),
    invalidate: vi.fn(),
  } as unknown as WebhookSecretsService;
}

async function seedTenant(
  tenants: TenantRepository,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await tenants.insert({
    tenant_id: "other-tenant",
    name: "Other Tenant",
    vertical: "AUTOMOTIVE",
    status: "ACTIVE",
    trial_ends_at: null,
    meta_access_token: null,
    meta_ad_account_id: null,
    meta_api_version: "v21.0",
    ...overrides,
  });
}

function buildStaticConnector(): MetaAdsConnector {
  const config = buildTestConfig();
  const connectorConfig = toConnectorConfig(config);
  if (!connectorConfig.ok) {
    throw new Error("test setup failed");
  }
  return MetaAdsConnectorFactory.create({
    config: connectorConfig.value,
    publisher: createFakePublisher(),
  });
}

describe("MetaAdsConnectorRegistry", () => {
  it("returns err(ConnectorNotConfiguredError) for a tenant with no meta_access_token/meta_ad_account_id — never falls back to the static connector", async () => {
    const config = buildTestConfig();
    const client = createFakeSupabaseClient();
    const tenants = new TenantRepository(client);
    await seedTenant(tenants);
    const staticConnector = buildStaticConnector();
    const registry = new MetaAdsConnectorRegistry(
      tenants,
      config,
      createFakePublisher(),
      staticConnector,
      buildFakeWebhookSecrets(),
    );

    const result = await registry.resolve("other-tenant");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConnectorNotConfiguredError);
    }
  });

  it("builds a real DB-backed connector for a tenant with a saved token+ad-account-id", async () => {
    const config = buildTestConfig();
    const client = createFakeSupabaseClient();
    const tenants = new TenantRepository(client);
    await seedTenant(tenants, {
      meta_access_token: "other-tenant-token",
      meta_ad_account_id: "act_111111111111111",
    });
    const staticConnector = buildStaticConnector();
    const registry = new MetaAdsConnectorRegistry(
      tenants,
      config,
      createFakePublisher(),
      staticConnector,
      buildFakeWebhookSecrets(),
    );

    const result = await registry.resolve("other-tenant");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.accessToken).toBe("other-tenant-token");
      expect(result.value.adAccountIds).toEqual(["act_111111111111111"]);
    }
  });

  it("caches the resolved connector — a second resolve() for the same tenant does not re-query tenants", async () => {
    const config = buildTestConfig();
    const client = createFakeSupabaseClient();
    const tenants = new TenantRepository(client);
    await seedTenant(tenants, {
      meta_access_token: "other-tenant-token",
      meta_ad_account_id: "act_111111111111111",
    });
    const findSpy = vi.spyOn(tenants, "findByTenantId");
    const staticConnector = buildStaticConnector();
    const registry = new MetaAdsConnectorRegistry(
      tenants,
      config,
      createFakePublisher(),
      staticConnector,
      buildFakeWebhookSecrets(),
    );

    const first = await registry.resolve("other-tenant");
    const second = await registry.resolve("other-tenant");
    expect(first.ok && second.ok && first.value === second.value).toBe(true);
    expect(findSpy).toHaveBeenCalledTimes(1);
  });

  it("dss-motor (AAOS_TENANT_ID) with a real, correctly-set DB row resolves to the DB-backed connector, not the static one (real bug fix regression guard)", async () => {
    const config = buildTestConfig();
    const client = createFakeSupabaseClient();
    const tenants = new TenantRepository(client);
    await seedTenant(tenants, {
      tenant_id: config.AAOS_TENANT_ID,
      meta_access_token: "dss-motor-real-token",
      meta_ad_account_id: "act_752072704610831",
    });
    const findSpy = vi.spyOn(tenants, "findByTenantId");
    const staticConnector = buildStaticConnector();
    const registry = new MetaAdsConnectorRegistry(
      tenants,
      config,
      createFakePublisher(),
      staticConnector,
      buildFakeWebhookSecrets(),
    );

    const result = await registry.resolve(config.AAOS_TENANT_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).not.toBe(staticConnector);
      expect(result.value.accessToken).toBe("dss-motor-real-token");
    }
    // DB-first: the real `tenants` lookup IS attempted for dss-motor now, same as every other
    // tenant.
    expect(findSpy).toHaveBeenCalledWith(config.AAOS_TENANT_ID);
  });

  it("dss-motor (AAOS_TENANT_ID) with an empty/unconfigured DB row still falls back to the static env-composed connector (regression guard for the live tenant's current real state)", async () => {
    const config = buildTestConfig();
    const client = createFakeSupabaseClient();
    const tenants = new TenantRepository(client);
    await seedTenant(tenants, { tenant_id: config.AAOS_TENANT_ID });
    const staticConnector = buildStaticConnector();
    const registry = new MetaAdsConnectorRegistry(
      tenants,
      config,
      createFakePublisher(),
      staticConnector,
      buildFakeWebhookSecrets(),
    );

    const result = await registry.resolve(config.AAOS_TENANT_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Never a literal-reference match: the static branch always spreads a NEW context object
      // (`{ ...this.staticConnector, accessToken, adAccountIds }`) — proving the static, .env-sourced
      // credentials were used is the real assertion here, not object identity.
      expect(result.value.accessToken).toBe(config.META_ACCESS_TOKEN);
      expect(result.value.adAccountIds).toEqual(config.META_AD_ACCOUNT_IDS);
    }
  });

  it("dss-motor (AAOS_TENANT_ID) with NO tenants row at all still falls back to the static connector", async () => {
    const config = buildTestConfig();
    const client = createFakeSupabaseClient();
    const tenants = new TenantRepository(client);
    const staticConnector = buildStaticConnector();
    const registry = new MetaAdsConnectorRegistry(
      tenants,
      config,
      createFakePublisher(),
      staticConnector,
      buildFakeWebhookSecrets(),
    );

    const result = await registry.resolve(config.AAOS_TENANT_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Never a literal-reference match: the static branch always spreads a NEW context object
      // (`{ ...this.staticConnector, accessToken, adAccountIds }`) — proving the static, .env-sourced
      // credentials were used is the real assertion here, not object identity.
      expect(result.value.accessToken).toBe(config.META_ACCESS_TOKEN);
      expect(result.value.adAccountIds).toEqual(config.META_AD_ACCOUNT_IDS);
    }
  });

  it("invalidate() now DOES clear the AAOS_TENANT_ID (dss-motor) cache entry too — a saved DB row must not keep serving a stale cached connector", async () => {
    const config = buildTestConfig();
    const client = createFakeSupabaseClient();
    const tenants = new TenantRepository(client);
    const findSpy = vi.spyOn(tenants, "findByTenantId");
    const staticConnector = buildStaticConnector();
    const registry = new MetaAdsConnectorRegistry(
      tenants,
      config,
      createFakePublisher(),
      staticConnector,
      buildFakeWebhookSecrets(),
    );

    await registry.resolve(config.AAOS_TENANT_ID);
    registry.invalidate(config.AAOS_TENANT_ID);
    await registry.resolve(config.AAOS_TENANT_ID);
    expect(findSpy).toHaveBeenCalledTimes(2);
  });

  it("dss-motor (AAOS_TENANT_ID) falls back to the static connector, without throwing, when tenants.findByTenantId itself fails (DB outage resilience)", async () => {
    const config = buildTestConfig();
    const tenants = {
      findByTenantId: vi.fn(async () => {
        throw new Error("network error");
      }),
    };
    const staticConnector = buildStaticConnector();
    const registry = new MetaAdsConnectorRegistry(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal repository test double
      tenants as any,
      config,
      createFakePublisher(),
      staticConnector,
      buildFakeWebhookSecrets(),
    );

    const result = await registry.resolve(config.AAOS_TENANT_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Never a literal-reference match: the static branch always spreads a NEW context object
      // (`{ ...this.staticConnector, accessToken, adAccountIds }`) — proving the static, .env-sourced
      // credentials were used is the real assertion here, not object identity.
      expect(result.value.accessToken).toBe(config.META_ACCESS_TOKEN);
      expect(result.value.adAccountIds).toEqual(config.META_AD_ACCOUNT_IDS);
    }
  });

  it("a regular (non-dss-motor) tenant gets a real ConnectorNotConfiguredError, never an unhandled throw, when tenants.findByTenantId fails", async () => {
    const config = buildTestConfig();
    const tenants = {
      findByTenantId: vi.fn(async () => {
        throw new Error("network error");
      }),
    };
    const staticConnector = buildStaticConnector();
    const registry = new MetaAdsConnectorRegistry(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal repository test double
      tenants as any,
      config,
      createFakePublisher(),
      staticConnector,
      buildFakeWebhookSecrets(),
    );

    const result = await registry.resolve("other-tenant");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConnectorNotConfiguredError);
    }
  });

  it("invalidate() clears a regular tenant's cache so the next resolve() re-queries tenants", async () => {
    const config = buildTestConfig();
    const client = createFakeSupabaseClient();
    const tenants = new TenantRepository(client);
    await seedTenant(tenants, {
      meta_access_token: "other-tenant-token",
      meta_ad_account_id: "act_111111111111111",
    });
    const findSpy = vi.spyOn(tenants, "findByTenantId");
    const staticConnector = buildStaticConnector();
    const registry = new MetaAdsConnectorRegistry(
      tenants,
      config,
      createFakePublisher(),
      staticConnector,
      buildFakeWebhookSecrets(),
    );

    await registry.resolve("other-tenant");
    registry.invalidate("other-tenant");
    await registry.resolve("other-tenant");
    expect(findSpy).toHaveBeenCalledTimes(2);
  });
});

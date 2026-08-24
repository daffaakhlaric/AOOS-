import { ok, err } from "@aos/common";
import { NotFoundError } from "@aos/errors";
import type { MetaAdsConnector } from "@aos/meta-ads-connector";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createFakeSupabaseClient } from "../../test-support/fake-supabase-client.js";
import { buildTestConfig } from "../../test-support/fixtures.js";
import { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";

import { WabaConfigRepository } from "./infrastructure/waba-config.repository.js";
import { SettingsService } from "./settings.service.js";

function buildFakeConnector(overrides: Partial<MetaAdsConnector["client"]> = {}): MetaAdsConnector {
  return {
    client: {
      getAdAccount: vi.fn(async () => ok({ id: "act_1", name: "Fake Ad Account" })),
      ...overrides,
    },
  } as unknown as MetaAdsConnector;
}

function buildFakeRegistry(): { invalidate: ReturnType<typeof vi.fn> } {
  return { invalidate: vi.fn() };
}

function buildService(connectorOverrides: Partial<MetaAdsConnector["client"]> = {}) {
  const client = createFakeSupabaseClient();
  const tenants = new TenantRepository(client);
  const wabaConfigs = new WabaConfigRepository(client);
  const connector = buildFakeConnector(connectorOverrides);
  const whatsAppConnectorRegistry = buildFakeRegistry();
  const metaAdsConnectorRegistry = buildFakeRegistry();
  const service = new SettingsService(
    tenants,
    wabaConfigs,
    connector,
    buildTestConfig(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal registry test double
    whatsAppConnectorRegistry as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal registry test double
    metaAdsConnectorRegistry as any,
  );
  return {
    service,
    tenants,
    wabaConfigs,
    connector,
    client,
    whatsAppConnectorRegistry,
    metaAdsConnectorRegistry,
  };
}

async function seedTenant(tenants: TenantRepository, overrides: Record<string, unknown> = {}) {
  return tenants.insert({
    tenant_id: "dss-motor",
    name: "DSS Motor",
    vertical: "AUTOMOTIVE",
    status: "ACTIVE",
    trial_ends_at: null,
    meta_access_token: null,
    meta_ad_account_id: null,
    meta_api_version: "v21.0",
    ...overrides,
  });
}

describe("SettingsService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getSettings() throws NotFoundError for an unknown tenant", async () => {
    const { service } = buildService();
    await expect(service.getSettings("missing")).rejects.toThrow(NotFoundError);
  });

  it("getSettings() reports usingEnvDefault=true when no per-tenant token is saved", async () => {
    const { service, tenants } = buildService();
    await seedTenant(tenants);
    const result = await service.getSettings("dss-motor");
    expect(result.meta.usingEnvDefault).toBe(true);
    expect(result.meta.accessToken).toBeUndefined();
  });

  it("getSettings() returns the real saved token once set", async () => {
    const { service, tenants } = buildService();
    await seedTenant(tenants, { meta_access_token: "tenant-token" });
    const result = await service.getSettings("dss-motor");
    expect(result.meta.usingEnvDefault).toBe(false);
    expect(result.meta.accessToken).toBe("tenant-token");
  });

  it("updateMeta() persists the new token/ad account id", async () => {
    const { service, tenants } = buildService();
    await seedTenant(tenants);
    const result = await service.updateMeta("dss-motor", {
      accessToken: "new-token",
      adAccountId: "act_999",
    });
    expect(result.meta.accessToken).toBe("new-token");
    expect(result.meta.adAccountId).toBe("act_999");
  });

  it("testMetaConnection() refuses to run when the tenant has no saved token (never falls back to the env default)", async () => {
    const { service, tenants, connector } = buildService();
    await seedTenant(tenants);
    const result = await service.testMetaConnection("dss-motor");
    expect(result.success).toBe(false);
    expect(result.message).toContain("Belum ada Meta Access Token");
    expect(connector.client.getAdAccount).not.toHaveBeenCalled();
  });

  it("testMetaConnection() calls Meta with the tenant's own token when saved", async () => {
    const { service, tenants, connector } = buildService();
    await seedTenant(tenants, { meta_access_token: "tenant-token", meta_ad_account_id: "act_1" });
    const result = await service.testMetaConnection("dss-motor");
    expect(result.success).toBe(true);
    expect(connector.client.getAdAccount).toHaveBeenCalledWith("act_1", "tenant-token");
  });

  it("testMetaConnection() surfaces a failed Meta call as success:false", async () => {
    const { service, tenants } = buildService({
      getAdAccount: vi.fn(async () => err({ message: "Invalid token" }) as never),
    });
    await seedTenant(tenants, { meta_access_token: "bad-token", meta_ad_account_id: "act_1" });
    const result = await service.testMetaConnection("dss-motor");
    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid token");
  });

  it("createWaba()/listWaba() round-trip a WABA config for the tenant, invalidating the tenant's cached connector", async () => {
    const { service, tenants, whatsAppConnectorRegistry } = buildService();
    await seedTenant(tenants);
    await service.createWaba("dss-motor", {
      branchId: "bintaro",
      phoneNumber: "+628110000001",
      wabaId: "waba-1",
      phoneNumberId: "phone-1",
      accessToken: "token-1",
    });
    const rows = await service.listWaba("dss-motor");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.branchId).toBe("BINTARO");
    expect(rows[0]?.maskedAccessToken).not.toBe("token-1");
    expect(whatsAppConnectorRegistry.invalidate).toHaveBeenCalledWith("dss-motor");
  });

  it("deleteWaba() throws NotFoundError for a config belonging to a different tenant", async () => {
    const { service, tenants, wabaConfigs } = buildService();
    await seedTenant(tenants);
    await seedTenant(tenants, { tenant_id: "other-tenant" });
    const row = await wabaConfigs.insert({
      tenant_id: "other-tenant",
      branch_id: "BINTARO",
      phone_number: "+1",
      waba_id: "w",
      phone_number_id: "p",
      access_token: "t",
      status: "ACTIVE",
    });
    await expect(service.deleteWaba("dss-motor", row.id)).rejects.toThrow(NotFoundError);
  });

  it("deleteWaba() invalidates the tenant's cached connector on a real delete", async () => {
    const { service, tenants, wabaConfigs, whatsAppConnectorRegistry } = buildService();
    await seedTenant(tenants);
    const row = await wabaConfigs.insert({
      tenant_id: "dss-motor",
      branch_id: "BINTARO",
      phone_number: "+1",
      waba_id: "w",
      phone_number_id: "p",
      access_token: "t",
      status: "ACTIVE",
    });
    await service.deleteWaba("dss-motor", row.id);
    expect(whatsAppConnectorRegistry.invalidate).toHaveBeenCalledWith("dss-motor");
  });

  it("testWaba() runs the real connection test and persists the result", async () => {
    const { service, tenants, wabaConfigs, whatsAppConnectorRegistry } = buildService();
    await seedTenant(tenants);
    const row = await wabaConfigs.insert({
      tenant_id: "dss-motor",
      branch_id: "BINTARO",
      phone_number: "+628110000001",
      waba_id: "waba-1",
      phone_number_id: "phone-1",
      access_token: "token-1",
      status: "ACTIVE",
    });
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ verified_name: "DSS Motor Bintaro" }), { status: 200 }),
    ) as unknown as typeof fetch;
    const result = await service.testWaba("dss-motor", row.id);
    expect(result.success).toBe(true);
    const updated = await wabaConfigs.findById(row.id);
    expect(updated?.last_test_result).toContain("DSS Motor Bintaro");
    // A successful test doesn't change any connector-relevant field (status stays ACTIVE), so no
    // invalidation is needed — see settings.service.ts's testWaba() doc.
    expect(whatsAppConnectorRegistry.invalidate).not.toHaveBeenCalled();
  });

  it("testWaba() invalidates the tenant's cached connector when the test fails (row flips to INACTIVE)", async () => {
    const { service, tenants, wabaConfigs, whatsAppConnectorRegistry } = buildService();
    await seedTenant(tenants);
    const row = await wabaConfigs.insert({
      tenant_id: "dss-motor",
      branch_id: "BINTARO",
      phone_number: "+628110000001",
      waba_id: "waba-1",
      phone_number_id: "phone-1",
      access_token: "token-1",
      status: "ACTIVE",
    });
    global.fetch = vi.fn(
      async () => new Response("Unauthorized", { status: 401 }),
    ) as unknown as typeof fetch;
    const result = await service.testWaba("dss-motor", row.id);
    expect(result.success).toBe(false);
    expect(whatsAppConnectorRegistry.invalidate).toHaveBeenCalledWith("dss-motor");
  });
});

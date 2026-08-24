import {
  Branch,
  PhoneNumberId,
  WhatsAppConnectorFactory,
  type WhatsAppConnector,
} from "@aos/whatsapp-connector";
import { describe, expect, it, vi } from "vitest";

import { toWhatsAppConnectorConfig } from "../../../config/to-whatsapp-connector-config.js";
import { createFakePublisher } from "../../../test-support/fake-publisher.js";
import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";
import { buildTestConfig } from "../../../test-support/fixtures.js";
import { WabaConfigRepository } from "../../settings/infrastructure/waba-config.repository.js";

import {
  ConnectorNotConfiguredError,
  WhatsAppConnectorRegistry,
} from "./whatsapp-connector-registry.js";

function seedRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "waba-1",
    tenant_id: "other-tenant",
    branch_id: "BINTARO",
    phone_number: "+628123456789",
    waba_id: "waba-other-1",
    phone_number_id: "phone-other-1",
    access_token: "token-other",
    status: "ACTIVE",
    last_tested_at: null,
    last_test_result: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function buildStaticConnector(): WhatsAppConnector {
  const config = buildTestConfig();
  const connectorConfig = toWhatsAppConnectorConfig(config);
  if (!connectorConfig.ok) {
    throw new Error("test setup failed");
  }
  return WhatsAppConnectorFactory.create({
    config: connectorConfig.value,
    publisher: createFakePublisher(),
  });
}

describe("WhatsAppConnectorRegistry", () => {
  it("resolves the static connector for the config's own AAOS_TENANT_ID, without querying waba_configs", async () => {
    const config = buildTestConfig();
    const client = createFakeSupabaseClient();
    const wabaConfigs = new WabaConfigRepository(client);
    const listSpy = vi.spyOn(wabaConfigs, "listByTenant");
    const staticConnector = buildStaticConnector();
    const registry = new WhatsAppConnectorRegistry(
      wabaConfigs,
      config,
      createFakePublisher(),
      staticConnector,
    );

    const result = await registry.resolve(config.AAOS_TENANT_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(staticConnector);
    }
    expect(listSpy).not.toHaveBeenCalled();
  });

  it("returns err(ConnectorNotConfiguredError) for a tenant with no waba_configs rows — never falls back to the static connector", async () => {
    const config = buildTestConfig();
    const client = createFakeSupabaseClient();
    const wabaConfigs = new WabaConfigRepository(client);
    const staticConnector = buildStaticConnector();
    const registry = new WhatsAppConnectorRegistry(
      wabaConfigs,
      config,
      createFakePublisher(),
      staticConnector,
    );

    const result = await registry.resolve("unconfigured-tenant");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConnectorNotConfiguredError);
    }
  });

  it("builds a real connector for a configured tenant, registering every branch's waba account", async () => {
    const config = buildTestConfig();
    const client = createFakeSupabaseClient();
    client.seed("waba_configs", seedRow());
    client.seed(
      "waba_configs",
      seedRow({ id: "waba-2", branch_id: "CINERE", phone_number_id: "phone-other-2" }),
    );
    const wabaConfigs = new WabaConfigRepository(client);
    const staticConnector = buildStaticConnector();
    const registry = new WhatsAppConnectorRegistry(
      wabaConfigs,
      config,
      createFakePublisher(),
      staticConnector,
    );

    const result = await registry.resolve("other-tenant");
    expect(result.ok).toBe(true);
    if (result.ok) {
      const phoneNumberIdResult = PhoneNumberId.create("phone-other-1");
      if (!phoneNumberIdResult.ok) {
        throw new Error("test setup failed");
      }
      const bintaroResult = result.value.registry.getByPhoneNumberId(phoneNumberIdResult.value);
      expect(bintaroResult.ok).toBe(true);
      if (bintaroResult.ok) {
        expect(bintaroResult.value.branch).toBe(Branch.BINTARO);
      }
    }
  });

  it("caches the resolved connector — a second resolve() for the same tenant does not re-query waba_configs", async () => {
    const config = buildTestConfig();
    const client = createFakeSupabaseClient();
    client.seed("waba_configs", seedRow());
    const wabaConfigs = new WabaConfigRepository(client);
    const listSpy = vi.spyOn(wabaConfigs, "listByTenant");
    const staticConnector = buildStaticConnector();
    const registry = new WhatsAppConnectorRegistry(
      wabaConfigs,
      config,
      createFakePublisher(),
      staticConnector,
    );

    const first = await registry.resolve("other-tenant");
    const second = await registry.resolve("other-tenant");
    expect(first.ok && second.ok && first.value === second.value).toBe(true);
    expect(listSpy).toHaveBeenCalledTimes(1);
  });

  it("uses the first row's access_token (by created_at) and warns when a tenant's rows carry different tokens, without failing", async () => {
    const config = buildTestConfig();
    const client = createFakeSupabaseClient();
    client.seed(
      "waba_configs",
      seedRow({ created_at: "2026-01-01T00:00:00.000Z", access_token: "token-a" }),
    );
    client.seed(
      "waba_configs",
      seedRow({
        id: "waba-2",
        branch_id: "CINERE",
        phone_number_id: "phone-other-2",
        created_at: "2026-01-02T00:00:00.000Z",
        access_token: "token-b",
      }),
    );
    const wabaConfigs = new WabaConfigRepository(client);
    const staticConnector = buildStaticConnector();
    const logger = { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() };
    const registry = new WhatsAppConnectorRegistry(
      wabaConfigs,
      config,
      createFakePublisher(),
      staticConnector,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal Logger test double
      logger as any,
    );

    const result = await registry.resolve("other-tenant");
    expect(result.ok).toBe(true);
    expect(logger.warn).toHaveBeenCalled();
  });

  it("invalidate() clears the cache so the next resolve() re-queries waba_configs", async () => {
    const config = buildTestConfig();
    const client = createFakeSupabaseClient();
    client.seed("waba_configs", seedRow());
    const wabaConfigs = new WabaConfigRepository(client);
    const listSpy = vi.spyOn(wabaConfigs, "listByTenant");
    const staticConnector = buildStaticConnector();
    const registry = new WhatsAppConnectorRegistry(
      wabaConfigs,
      config,
      createFakePublisher(),
      staticConnector,
    );

    await registry.resolve("other-tenant");
    registry.invalidate("other-tenant");
    await registry.resolve("other-tenant");
    expect(listSpy).toHaveBeenCalledTimes(2);
  });

  it("invalidate() is a no-op for the AAOS_TENANT_ID (dss-motor's static fallback never goes stale via waba_configs)", async () => {
    const config = buildTestConfig();
    const client = createFakeSupabaseClient();
    const wabaConfigs = new WabaConfigRepository(client);
    const staticConnector = buildStaticConnector();
    const registry = new WhatsAppConnectorRegistry(
      wabaConfigs,
      config,
      createFakePublisher(),
      staticConnector,
    );

    await registry.resolve(config.AAOS_TENANT_ID);
    registry.invalidate(config.AAOS_TENANT_ID);
    const result = await registry.resolve(config.AAOS_TENANT_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(staticConnector);
    }
  });
});

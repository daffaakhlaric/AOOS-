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
import type { WebhookSecretsService } from "../../webhook-config/webhook-secrets.service.js";

import {
  ConnectorNotConfiguredError,
  WhatsAppConnectorRegistry,
} from "./whatsapp-connector-registry.js";

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
  it("dss-motor (AAOS_TENANT_ID) with NO waba_configs rows still falls back to the static connector (regression guard for the live tenant's current real state) — but the DB IS queried first", async () => {
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
      buildFakeWebhookSecrets(),
    );

    const result = await registry.resolve(config.AAOS_TENANT_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(staticConnector);
    }
    // DB-first: the real waba_configs lookup IS attempted for dss-motor now, same as every other
    // tenant — only after it comes back empty does the static fallback kick in.
    expect(listSpy).toHaveBeenCalledWith(config.AAOS_TENANT_ID);
  });

  it("dss-motor (AAOS_TENANT_ID) with a real, populated ACTIVE waba_configs row resolves to the DB-backed connector, not the static one", async () => {
    const config = buildTestConfig();
    const client = createFakeSupabaseClient();
    client.seed(
      "waba_configs",
      seedRow({ tenant_id: config.AAOS_TENANT_ID, access_token: "dss-motor-real-token" }),
    );
    const wabaConfigs = new WabaConfigRepository(client);
    const staticConnector = buildStaticConnector();
    const registry = new WhatsAppConnectorRegistry(
      wabaConfigs,
      config,
      createFakePublisher(),
      staticConnector,
      buildFakeWebhookSecrets(),
    );

    const result = await registry.resolve(config.AAOS_TENANT_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).not.toBe(staticConnector);
    }
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
      buildFakeWebhookSecrets(),
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
      buildFakeWebhookSecrets(),
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
      buildFakeWebhookSecrets(),
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
      buildFakeWebhookSecrets(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal Logger test double
      logger as any,
    );

    const result = await registry.resolve("other-tenant");
    expect(result.ok).toBe(true);
    expect(logger.warn).toHaveBeenCalled();
  });

  it("dss-motor (AAOS_TENANT_ID) falls back to the static connector, without throwing, when wabaConfigs.listByTenant itself fails (DB outage resilience)", async () => {
    const config = buildTestConfig();
    const wabaConfigs = {
      listByTenant: vi.fn(async () => {
        throw new Error("network error");
      }),
    };
    const staticConnector = buildStaticConnector();
    const registry = new WhatsAppConnectorRegistry(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal repository test double
      wabaConfigs as any,
      config,
      createFakePublisher(),
      staticConnector,
      buildFakeWebhookSecrets(),
    );

    const result = await registry.resolve(config.AAOS_TENANT_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(staticConnector);
    }
  });

  it("a regular (non-dss-motor) tenant gets a real ConnectorNotConfiguredError, never an unhandled throw, when wabaConfigs.listByTenant fails", async () => {
    const config = buildTestConfig();
    const wabaConfigs = {
      listByTenant: vi.fn(async () => {
        throw new Error("network error");
      }),
    };
    const staticConnector = buildStaticConnector();
    const registry = new WhatsAppConnectorRegistry(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal repository test double
      wabaConfigs as any,
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
      buildFakeWebhookSecrets(),
    );

    await registry.resolve("other-tenant");
    registry.invalidate("other-tenant");
    await registry.resolve("other-tenant");
    expect(listSpy).toHaveBeenCalledTimes(2);
  });

  it("invalidate() now DOES clear the AAOS_TENANT_ID (dss-motor) cache entry too — a saved DB row must not keep serving a stale cached connector", async () => {
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
      buildFakeWebhookSecrets(),
    );

    await registry.resolve(config.AAOS_TENANT_ID);
    registry.invalidate(config.AAOS_TENANT_ID);
    await registry.resolve(config.AAOS_TENANT_ID);
    expect(listSpy).toHaveBeenCalledTimes(2);
  });
});

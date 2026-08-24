import { ok, type Result } from "@aos/common";
import { MetaAdsConnectorFactory, type MetaAdsConnector } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { toConnectorConfig } from "../../config/to-connector-config.js";
import { createFakePublisher } from "../../test-support/fake-publisher.js";
import { buildTestConfig } from "../../test-support/fixtures.js";
import type {
  ConnectorNotConfiguredError,
  MetaAdsConnectorContext,
} from "../meta-ads/infrastructure/meta-ads-connector-registry.js";

import { HealthController } from "./health.controller.js";

function buildConnector(): MetaAdsConnector {
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

/** Minimal registry test double — mirrors `MetaAdsConnectorRegistry`'s real `resolve(tenantId)` shape, always returning the SAME connector regardless of tenantId (this controller only ever resolves the static `AAOS_TENANT_ID`). */
function buildFakeRegistry(connector: MetaAdsConnector): {
  resolve: (
    tenantId: string,
  ) => Promise<Result<MetaAdsConnectorContext, ConnectorNotConfiguredError>>;
} {
  const context: MetaAdsConnectorContext = {
    ...connector,
    accessToken: "fake-token",
    adAccountIds: ["act_1"],
  };
  return { resolve: async () => ok(context) };
}

describe("HealthController", () => {
  it("GET /health returns status ok, a version, and an ISO timestamp", () => {
    const controller = new HealthController(
      buildTestConfig(),
      buildFakeRegistry(buildConnector()) as never,
    );
    const response = controller.getHealth();
    expect(response.status).toBe("ok");
    expect(response.version).toBe("0.1.0");
    expect(() => new Date(response.timestamp).toISOString()).not.toThrow();
  });

  it("GET /ready returns ready:true with both checks true for a valid config + connector", async () => {
    const controller = new HealthController(
      buildTestConfig(),
      buildFakeRegistry(buildConnector()) as never,
    );
    const response = await controller.getReady();
    expect(response.status).toBe("ready");
    expect(response.checks).toEqual({ config: true, metaAdsConnector: true });
  });

  it("GET /ready reports not_ready when the config check fails", async () => {
    const controller = new HealthController(
      buildTestConfig({ AAOS_TENANT_ID: "" }) as AaosApiConfig,
      buildFakeRegistry(buildConnector()) as never,
    );
    const response = await controller.getReady();
    expect(response.status).toBe("not_ready");
    expect(response.checks.config).toBe(false);
  });

  it("GET /ready reports not_ready when META_AD_ACCOUNT_IDS is empty", async () => {
    const controller = new HealthController(
      buildTestConfig({ META_AD_ACCOUNT_IDS: [] }),
      buildFakeRegistry(buildConnector()) as never,
    );
    const response = await controller.getReady();
    expect(response.checks.config).toBe(false);
  });

  it("GET /ready reports not_ready when the connector is missing a use case", async () => {
    const incompleteConnector = {
      ...buildConnector(),
      pullCampaignData: undefined,
    } as unknown as MetaAdsConnector;
    const controller = new HealthController(
      buildTestConfig(),
      buildFakeRegistry(incompleteConnector) as never,
    );
    const response = await controller.getReady();
    expect(response.checks.metaAdsConnector).toBe(false);
  });

  it("GET /ready reports not_ready when the tenant's connector fails to resolve", async () => {
    const controller = new HealthController(buildTestConfig(), {
      resolve: async () => ({ ok: false, error: new Error("not configured") }),
    } as never);
    const response = await controller.getReady();
    expect(response.status).toBe("not_ready");
    expect(response.checks.metaAdsConnector).toBe(false);
  });

  it("returns a stable version across repeated GET /health calls (read once at construction)", () => {
    const controller = new HealthController(
      buildTestConfig(),
      buildFakeRegistry(buildConnector()) as never,
    );
    const first = controller.getHealth();
    const second = controller.getHealth();
    expect(first.version).toBe(second.version);
  });
});

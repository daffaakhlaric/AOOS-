import { MetaAdsConnectorFactory } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { toConnectorConfig } from "../../config/to-connector-config.js";
import { createFakePublisher } from "../../test-support/fake-publisher.js";
import { buildTestConfig } from "../../test-support/fixtures.js";

import { HealthController } from "./health.controller.js";

function buildConnector(): ReturnType<typeof MetaAdsConnectorFactory.create> {
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

describe("HealthController", () => {
  it("GET /health returns status ok, a version, and an ISO timestamp", () => {
    const controller = new HealthController(buildTestConfig(), buildConnector());
    const response = controller.getHealth();
    expect(response.status).toBe("ok");
    expect(response.version).toBe("0.1.0");
    expect(() => new Date(response.timestamp).toISOString()).not.toThrow();
  });

  it("GET /ready returns ready:true with both checks true for a valid config + connector", () => {
    const controller = new HealthController(buildTestConfig(), buildConnector());
    const response = controller.getReady();
    expect(response.status).toBe("ready");
    expect(response.checks).toEqual({ config: true, metaAdsConnector: true });
  });

  it("GET /ready reports not_ready when the config check fails", () => {
    const controller = new HealthController(
      buildTestConfig({ AAOS_TENANT_ID: "" }),
      buildConnector(),
    );
    const response = controller.getReady();
    expect(response.status).toBe("not_ready");
    expect(response.checks.config).toBe(false);
  });

  it("GET /ready reports not_ready when META_AD_ACCOUNT_IDS is empty", () => {
    const controller = new HealthController(
      buildTestConfig({ META_AD_ACCOUNT_IDS: [] }),
      buildConnector(),
    );
    const response = controller.getReady();
    expect(response.checks.config).toBe(false);
  });

  it("GET /ready reports not_ready when the connector is missing a use case", () => {
    const incompleteConnector = {
      ...buildConnector(),
      pullCampaignData: undefined,
    } as unknown as ReturnType<typeof MetaAdsConnectorFactory.create>;
    const controller = new HealthController(buildTestConfig(), incompleteConnector);
    const response = controller.getReady();
    expect(response.checks.metaAdsConnector).toBe(false);
  });

  it("returns a stable version across repeated GET /health calls (read once at construction)", () => {
    const controller = new HealthController(buildTestConfig(), buildConnector());
    const first = controller.getHealth();
    const second = controller.getHealth();
    expect(first.version).toBe(second.version);
  });
});

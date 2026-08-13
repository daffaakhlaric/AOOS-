import type { CapiConnectorConfig } from "../../src/config/CapiConnectorConfig.js";

export function buildConfig(overrides: Partial<CapiConnectorConfig> = {}): CapiConnectorConfig {
  return {
    pixelId: "123456789",
    accessToken: "TEST_ACCESS_TOKEN",
    apiVersion: "v21.0",
    baseUrl: "https://graph.facebook.com",
    eventSourceUrl: "https://mobixbydss.id",
    batchSize: 1,
    flushIntervalMs: 0,
    retryMaxAttempts: 3,
    retryBaseDelayMs: 1000,
    tenantId: "dss-motor",
    ...overrides,
  };
}

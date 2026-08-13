import { describe, expect, it } from "vitest";

import {
  DEFAULT_CAPI_CONNECTOR_CONFIG,
  parseCapiConnectorConfig,
} from "../../../src/config/CapiConnectorConfig.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("parseCapiConnectorConfig", () => {
  it("parses a minimal valid input, filling in defaults", () => {
    const config = unwrap(
      parseCapiConnectorConfig({
        pixelId: "123456789",
        accessToken: "TOKEN",
        tenantId: "dss-motor",
      }),
    );
    expect(config).toEqual({
      pixelId: "123456789",
      accessToken: "TOKEN",
      tenantId: "dss-motor",
      ...DEFAULT_CAPI_CONNECTOR_CONFIG,
    });
  });

  it("accepts an explicit testEventCode", () => {
    const config = unwrap(
      parseCapiConnectorConfig({
        pixelId: "123456789",
        accessToken: "TOKEN",
        tenantId: "dss-motor",
        testEventCode: "TEST12345",
      }),
    );
    expect(config.testEventCode).toBe("TEST12345");
  });

  it("rejects a missing pixelId", () => {
    const error = unwrapErr(
      parseCapiConnectorConfig({ accessToken: "TOKEN", tenantId: "dss-motor" }),
    );
    expect(error.message).toContain("CapiConnectorConfig validation failed");
  });

  it("rejects an empty accessToken", () => {
    expect(
      parseCapiConnectorConfig({ pixelId: "123", accessToken: "", tenantId: "dss-motor" }).ok,
    ).toBe(false);
  });

  it("rejects an empty tenantId", () => {
    expect(
      parseCapiConnectorConfig({ pixelId: "123", accessToken: "TOKEN", tenantId: "" }).ok,
    ).toBe(false);
  });

  it("rejects a non-https eventSourceUrl", () => {
    const result = parseCapiConnectorConfig({
      pixelId: "123",
      accessToken: "TOKEN",
      tenantId: "dss-motor",
      eventSourceUrl: "http://mobixbydss.id",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a batchSize over 1000", () => {
    expect(
      parseCapiConnectorConfig({
        pixelId: "123",
        accessToken: "TOKEN",
        tenantId: "dss-motor",
        batchSize: 1001,
      }).ok,
    ).toBe(false);
  });

  it("rejects a completely non-object input", () => {
    expect(parseCapiConnectorConfig("not-an-object").ok).toBe(false);
  });

  it("DEFAULT_CAPI_CONNECTOR_CONFIG matches the spec's stated defaults", () => {
    expect(DEFAULT_CAPI_CONNECTOR_CONFIG).toEqual({
      apiVersion: "v21.0",
      baseUrl: "https://graph.facebook.com",
      eventSourceUrl: "https://mobixbydss.id",
      batchSize: 1,
      flushIntervalMs: 0,
      retryMaxAttempts: 3,
      retryBaseDelayMs: 1000,
    });
  });
});

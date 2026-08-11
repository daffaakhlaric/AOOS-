import { describe, expect, it } from "vitest";

import { parseMetaAdsConnectorConfig } from "../../../src/config/MetaAdsConnectorConfig.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    apiVersion: "v21.0",
    baseUrl: "https://graph.facebook.com",
    accessToken: "token-abc",
    adAccountIds: ["act_752604553578354"],
    webhookVerifyToken: "verify-token",
    webhookAppSecret: "app-secret",
    tenantId: "dss-motor",
    ...overrides,
  };
}

describe("parseMetaAdsConnectorConfig", () => {
  it("parses a valid config and applies documented defaults", () => {
    const config = unwrap(parseMetaAdsConnectorConfig(validInput()));
    expect(config.rateLimitPerHour).toBe(200);
    expect(config.retryMaxAttempts).toBe(3);
    expect(config.retryBaseDelayMs).toBe(1000);
    expect(config.timeoutMs).toBe(30000);
  });

  it("accepts explicit overrides for every default field", () => {
    const config = unwrap(
      parseMetaAdsConnectorConfig(
        validInput({
          rateLimitPerHour: 100,
          retryMaxAttempts: 5,
          retryBaseDelayMs: 2000,
          timeoutMs: 60000,
        }),
      ),
    );
    expect(config.rateLimitPerHour).toBe(100);
    expect(config.retryMaxAttempts).toBe(5);
    expect(config.retryBaseDelayMs).toBe(2000);
    expect(config.timeoutMs).toBe(60000);
  });

  it("rejects an apiVersion other than v21.0", () => {
    expect(parseMetaAdsConnectorConfig(validInput({ apiVersion: "v20.0" })).ok).toBe(false);
  });

  it("rejects a baseUrl other than the documented literal", () => {
    expect(parseMetaAdsConnectorConfig(validInput({ baseUrl: "https://example.com" })).ok).toBe(
      false,
    );
  });

  it("rejects an empty accessToken", () => {
    expect(unwrapErr(parseMetaAdsConnectorConfig(validInput({ accessToken: "" }))).message).toMatch(
      /accessToken/,
    );
  });

  it("rejects an empty adAccountIds array", () => {
    expect(parseMetaAdsConnectorConfig(validInput({ adAccountIds: [] })).ok).toBe(false);
  });

  it("rejects an adAccountId not matching the act_<digits> pattern", () => {
    expect(parseMetaAdsConnectorConfig(validInput({ adAccountIds: ["752604553578354"] })).ok).toBe(
      false,
    );
  });

  it("accepts multiple ad accounts (multi-account edge case)", () => {
    const config = unwrap(
      parseMetaAdsConnectorConfig(validInput({ adAccountIds: ["act_1", "act_2"] })),
    );
    expect(config.adAccountIds).toHaveLength(2);
  });

  it("rejects an empty webhookVerifyToken", () => {
    expect(parseMetaAdsConnectorConfig(validInput({ webhookVerifyToken: "" })).ok).toBe(false);
  });

  it("rejects an empty webhookAppSecret", () => {
    expect(parseMetaAdsConnectorConfig(validInput({ webhookAppSecret: "" })).ok).toBe(false);
  });

  it("rejects an empty tenantId", () => {
    expect(parseMetaAdsConnectorConfig(validInput({ tenantId: "" })).ok).toBe(false);
  });

  it("rejects a non-positive rateLimitPerHour", () => {
    expect(parseMetaAdsConnectorConfig(validInput({ rateLimitPerHour: 0 })).ok).toBe(false);
  });

  it("rejects a non-integer retryMaxAttempts", () => {
    expect(parseMetaAdsConnectorConfig(validInput({ retryMaxAttempts: 1.5 })).ok).toBe(false);
  });

  it("wraps every failure as a ConnectorConfigError with a combined message", () => {
    const error = unwrapErr(parseMetaAdsConnectorConfig({}));
    expect(error.message).toMatch(/MetaAdsConnectorConfig validation failed/);
  });

  it('labels a root-level validation issue as "(root)" (input isn\'t an object at all)', () => {
    const error = unwrapErr(parseMetaAdsConnectorConfig(null));
    expect(error.message).toMatch(/\(root\)/);
  });
});

import { describe, expect, it } from "vitest";

import { buildTestConfig } from "../test-support/fixtures.js";

import { toConnectorConfig } from "./to-connector-config.js";

describe("toConnectorConfig", () => {
  it("translates a valid AaosApiConfig into a MetaAdsConnectorConfig", () => {
    const result = toConnectorConfig(buildTestConfig());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.apiVersion).toBe("v21.0");
      expect(result.value.baseUrl).toBe("https://graph.facebook.com");
      expect(result.value.accessToken).toBe("test-access-token");
      expect(result.value.adAccountIds).toEqual(["act_752604553578354"]);
      expect(result.value.tenantId).toBe("dss-motor");
    }
  });

  it("fails with ConnectorConfigError when META_API_VERSION is not the literal v21.0", () => {
    const result = toConnectorConfig(buildTestConfig({ META_API_VERSION: "v20.0" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.constructor.name).toBe("ConnectorConfigError");
    }
  });

  it("fails when META_ACCESS_TOKEN is empty", () => {
    const result = toConnectorConfig(buildTestConfig({ META_ACCESS_TOKEN: "" }));
    expect(result.ok).toBe(false);
  });

  it("fails when META_AD_ACCOUNT_IDS is empty", () => {
    const result = toConnectorConfig(buildTestConfig({ META_AD_ACCOUNT_IDS: [] }));
    expect(result.ok).toBe(false);
  });
});

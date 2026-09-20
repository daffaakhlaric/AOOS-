import { describe, expect, it } from "vitest";

import { buildTestConfig } from "../test-support/fixtures.js";

import { KIE_WEBHOOK_PATH, toCreativeConnectorConfig } from "./to-creative-connector-config.js";

describe("toCreativeConnectorConfig", () => {
  it("PROMPT 53 — omits callbackUrl (undefined) when neither AAOS_API_BASE_URL nor KIE_WEBHOOK_SECRET is configured — the pre-existing, unaffected polling-only behavior", () => {
    const config = buildTestConfig({
      KIE_AI_API_KEY: "test-kie-key",
      AAOS_API_BASE_URL: "",
      KIE_WEBHOOK_SECRET: "",
    });
    const result = toCreativeConnectorConfig(config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.callbackUrl).toBeUndefined();
    }
  });

  it("omits callbackUrl when only AAOS_API_BASE_URL is configured (no secret to authenticate the callback with)", () => {
    const config = buildTestConfig({
      KIE_AI_API_KEY: "test-kie-key",
      AAOS_API_BASE_URL: "https://api.example.com",
      KIE_WEBHOOK_SECRET: "",
    });
    const result = toCreativeConnectorConfig(config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.callbackUrl).toBeUndefined();
    }
  });

  it("omits callbackUrl when only KIE_WEBHOOK_SECRET is configured (no public base URL to build a reachable callback from)", () => {
    const config = buildTestConfig({
      KIE_AI_API_KEY: "test-kie-key",
      AAOS_API_BASE_URL: "",
      KIE_WEBHOOK_SECRET: "test-secret",
    });
    const result = toCreativeConnectorConfig(config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.callbackUrl).toBeUndefined();
    }
  });

  it("builds a real callbackUrl (base URL + the real mounted webhook path + secret query param) when both are configured", () => {
    const config = buildTestConfig({
      KIE_AI_API_KEY: "test-kie-key",
      AAOS_API_BASE_URL: "https://api.example.com",
      KIE_WEBHOOK_SECRET: "test-secret",
    });
    const result = toCreativeConnectorConfig(config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.callbackUrl).toBe(
        `https://api.example.com${KIE_WEBHOOK_PATH}?secret=test-secret`,
      );
    }
  });

  it("strips a trailing slash from AAOS_API_BASE_URL before appending the webhook path", () => {
    const config = buildTestConfig({
      KIE_AI_API_KEY: "test-kie-key",
      AAOS_API_BASE_URL: "https://api.example.com/",
      KIE_WEBHOOK_SECRET: "test-secret",
    });
    const result = toCreativeConnectorConfig(config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.callbackUrl).toBe(
        `https://api.example.com${KIE_WEBHOOK_PATH}?secret=test-secret`,
      );
    }
  });

  it("URL-encodes a secret containing characters that would otherwise break the query string", () => {
    const config = buildTestConfig({
      KIE_AI_API_KEY: "test-kie-key",
      AAOS_API_BASE_URL: "https://api.example.com",
      KIE_WEBHOOK_SECRET: "sec ret&x=1",
    });
    const result = toCreativeConnectorConfig(config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.callbackUrl).toBe(
        `https://api.example.com${KIE_WEBHOOK_PATH}?secret=${encodeURIComponent("sec ret&x=1")}`,
      );
    }
  });
});

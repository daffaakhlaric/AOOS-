import { describe, expect, it } from "vitest";

import { parseCreativeConnectorConfig } from "../../../src/config/CreativeConnectorConfig.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("parseCreativeConnectorConfig", () => {
  it("parses a minimal valid config, applying documented defaults", () => {
    const config = unwrap(parseCreativeConnectorConfig({ apiKey: "key", tenantId: "tenant-1" }));
    expect(config.generationBaseUrl).toBe("https://api.kie.ai");
    expect(config.uploadBaseUrl).toBe("https://kieai.redpandaai.co");
    expect(config.defaultVideoModel).toBe("veo3_fast");
    expect(config.defaultImageModel).toBe("google/nano-banana-pro");
    expect(config.defaultAspectRatio).toBe("16:9");
    expect(config.pollIntervalMs).toBe(5000);
    expect(config.maxPollDurationMs).toBe(300000);
    expect(config.rateLimitPerTenSeconds).toBe(20);
  });

  it("accepts an explicit full config", () => {
    const config = unwrap(
      parseCreativeConnectorConfig({
        apiKey: "key",
        generationBaseUrl: "https://api.kie.ai",
        uploadBaseUrl: "https://kieai.redpandaai.co",
        defaultVideoModel: "veo3",
        defaultImageModel: "google/nano-banana-pro",
        defaultAspectRatio: "9:16",
        callbackUrl: "https://example.com/callback",
        pollIntervalMs: 1000,
        maxPollDurationMs: 60000,
        rateLimitPerTenSeconds: 10,
        tenantId: "tenant-1",
      }),
    );
    expect(config.defaultVideoModel).toBe("veo3");
    expect(config.callbackUrl).toBe("https://example.com/callback");
  });

  it("rejects a missing apiKey", () => {
    const error = unwrapErr(parseCreativeConnectorConfig({ tenantId: "tenant-1" }));
    expect(error.message).toMatch(/apiKey/);
  });

  it("rejects a missing tenantId", () => {
    const error = unwrapErr(parseCreativeConnectorConfig({ apiKey: "key" }));
    expect(error.message).toMatch(/tenantId/);
  });

  it("rejects an invalid callbackUrl", () => {
    const error = unwrapErr(
      parseCreativeConnectorConfig({ apiKey: "key", tenantId: "t", callbackUrl: "not-a-url" }),
    );
    expect(error.message).toMatch(/callbackUrl/);
  });

  it("rejects a wrong generationBaseUrl", () => {
    const error = unwrapErr(
      parseCreativeConnectorConfig({
        apiKey: "key",
        tenantId: "t",
        generationBaseUrl: "https://wrong.host",
      }),
    );
    expect(error.message).toMatch(/generationBaseUrl/);
  });

  it("rejects an unsupported defaultVideoModel", () => {
    const error = unwrapErr(
      parseCreativeConnectorConfig({ apiKey: "key", tenantId: "t", defaultVideoModel: "veo4" }),
    );
    expect(error.message).toMatch(/defaultVideoModel/);
  });

  it("rejects a non-object input", () => {
    const error = unwrapErr(parseCreativeConnectorConfig("not an object"));
    expect(error.message).toMatch(/CreativeConnectorConfig validation failed/);
  });
});

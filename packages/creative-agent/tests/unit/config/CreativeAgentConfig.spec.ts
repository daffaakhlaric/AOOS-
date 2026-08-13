import { describe, expect, it } from "vitest";

import {
  DEFAULT_CREATIVE_AGENT_CONFIG,
  parseCreativeAgentConfig,
} from "../../../src/config/CreativeAgentConfig.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("CreativeAgentConfig", () => {
  it("parses DEFAULT_CREATIVE_AGENT_CONFIG successfully with documented defaults", () => {
    const config = unwrap(parseCreativeAgentConfig(DEFAULT_CREATIVE_AGENT_CONFIG));
    expect(config.tenantId).toBe("dss-motor");
    expect(config.agentName).toBe("Kai");
    expect(config.defaultVideoModel).toBe("veo3_fast");
    expect(config.defaultImageCount).toBe(3);
    expect(config.videoFallbackOnError).toBe(true);
    expect(config.maxGenerationWaitMs).toBe(600_000);
  });

  it("accepts explicit overrides", () => {
    const config = unwrap(
      parseCreativeAgentConfig({
        tenantId: "custom-tenant",
        defaultVideoModel: "veo3",
        defaultImageCount: 5,
        videoFallbackOnError: false,
        maxGenerationWaitMs: 120_000,
      }),
    );
    expect(config.tenantId).toBe("custom-tenant");
    expect(config.defaultVideoModel).toBe("veo3");
    expect(config.defaultImageCount).toBe(5);
    expect(config.videoFallbackOnError).toBe(false);
    expect(config.maxGenerationWaitMs).toBe(120_000);
  });

  it("rejects a missing tenantId", () => {
    const error = unwrapErr(parseCreativeAgentConfig({}));
    expect(error.message).toContain("tenantId");
  });

  it("rejects an empty tenantId", () => {
    const error = unwrapErr(parseCreativeAgentConfig({ tenantId: "" }));
    expect(error.message).toContain("tenantId");
  });

  it("rejects an invalid defaultVideoModel", () => {
    const error = unwrapErr(parseCreativeAgentConfig({ tenantId: "t", defaultVideoModel: "veo4" }));
    expect(error.message).toContain("defaultVideoModel");
  });

  it("rejects a negative defaultImageCount", () => {
    const error = unwrapErr(parseCreativeAgentConfig({ tenantId: "t", defaultImageCount: -1 }));
    expect(error.message).toContain("defaultImageCount");
  });

  it("rejects a non-object input", () => {
    const error = unwrapErr(parseCreativeAgentConfig("not-an-object"));
    expect(error.message).toContain("CreativeAgentConfig");
  });
});

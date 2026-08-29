import { describe, expect, it } from "vitest";

import { parseSalesAgentConfig } from "../../../src/config/SalesAgentConfig.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("parseSalesAgentConfig", () => {
  it("applies defaults for hotThreshold/warmThreshold/noReplyTimeoutMs etc.", () => {
    const config = unwrap(parseSalesAgentConfig({ tenantId: "tenant-dss-motor" }));
    expect(config.agentName).toBe("Clara");
    expect(config.language).toBe("id");
    expect(config.hotThreshold).toBe(65);
    expect(config.warmThreshold).toBe(31);
    expect(config.noReplyTimeoutMs).toBe(21_600_000);
    expect(config.minResponseDelayMs).toBe(800);
    expect(config.maxResponseDelayMs).toBe(3000);
    expect(config.followUpEnabled).toBe(true);
    expect(config.followUpDays).toEqual([3, 7, 14]);
    expect(config.llmReplyEnabled).toBe(false);
    expect(config.openaiApiKey).toBeUndefined();
    expect(config.openaiModel).toBe("gpt-4o-mini");
    expect(config.openaiTimeoutMs).toBe(8_000);
  });

  it("rejects a missing tenantId", () => {
    expect(unwrapErr(parseSalesAgentConfig({})).message).toContain("validation failed");
  });

  it("rejects warmThreshold >= hotThreshold", () => {
    expect(
      unwrapErr(parseSalesAgentConfig({ tenantId: "t", warmThreshold: 70, hotThreshold: 65 }))
        .message,
    ).toContain("warmThreshold");
  });

  it("rejects minResponseDelayMs > maxResponseDelayMs", () => {
    expect(
      unwrapErr(
        parseSalesAgentConfig({
          tenantId: "t",
          minResponseDelayMs: 5000,
          maxResponseDelayMs: 1000,
        }),
      ).message,
    ).toContain("minResponseDelayMs");
  });

  it("accepts explicit overrides", () => {
    const config = unwrap(
      parseSalesAgentConfig({
        tenantId: "t",
        hotThreshold: 70,
        warmThreshold: 40,
        followUpDays: [1, 5],
      }),
    );
    expect(config.hotThreshold).toBe(70);
    expect(config.warmThreshold).toBe(40);
    expect(config.followUpDays).toEqual([1, 5]);
  });

  it("accepts explicit LLM overrides", () => {
    const config = unwrap(
      parseSalesAgentConfig({
        tenantId: "t",
        llmReplyEnabled: true,
        openaiApiKey: "sk-test",
        openaiModel: "gpt-4o",
        openaiTimeoutMs: 5_000,
      }),
    );
    expect(config.llmReplyEnabled).toBe(true);
    expect(config.openaiApiKey).toBe("sk-test");
    expect(config.openaiModel).toBe("gpt-4o");
    expect(config.openaiTimeoutMs).toBe(5_000);
  });

  it("rejects an empty-string openaiApiKey", () => {
    expect(unwrapErr(parseSalesAgentConfig({ tenantId: "t", openaiApiKey: "" })).message).toContain(
      "validation failed",
    );
  });

  it("rejects a non-object input", () => {
    expect(unwrapErr(parseSalesAgentConfig(null)).message).toContain("validation failed");
  });
});

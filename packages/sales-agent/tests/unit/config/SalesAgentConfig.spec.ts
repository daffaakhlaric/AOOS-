import { describe, expect, it } from "vitest";

import { parseSalesAgentConfig } from "../../../src/config/SalesAgentConfig.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("parseSalesAgentConfig", () => {
  it("applies defaults for hotThreshold/warmThreshold/noReplyTimeoutMs etc.", () => {
    const config = unwrap(parseSalesAgentConfig({ tenantId: "tenant-dss-motor" }));
    expect(config.agentName).toBe("Jessy");
    expect(config.language).toBe("id");
    expect(config.hotThreshold).toBe(65);
    expect(config.warmThreshold).toBe(31);
    expect(config.noReplyTimeoutMs).toBe(21_600_000);
    expect(config.minResponseDelayMs).toBe(800);
    expect(config.maxResponseDelayMs).toBe(3000);
    expect(config.followUpEnabled).toBe(true);
    expect(config.followUpDays).toEqual([3, 7, 14]);
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

  it("rejects a non-object input", () => {
    expect(unwrapErr(parseSalesAgentConfig(null)).message).toContain("validation failed");
  });
});

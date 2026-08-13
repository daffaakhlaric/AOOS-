import { describe, expect, it } from "vitest";

import {
  DEFAULT_META_ADS_AGENT_CONFIG,
  parseMetaAdsAgentConfig,
} from "../../../src/config/MetaAdsAgentConfig.js";

describe("parseMetaAdsAgentConfig", () => {
  it("parses valid input with defaults applied", () => {
    const result = parseMetaAdsAgentConfig({ tenantId: "dss-motor" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.agentName).toBe("Tamara");
    expect(result.value.language).toBe("id");
    expect(result.value.maxAutoScaleBudgetIDR).toBe(500_000);
    expect(result.value.maxAutoReallocationIDR).toBe(2_000_000);
    expect(result.value.highSpendThresholdIDR).toBe(1_000_000);
    expect(result.value.autoExecutePauseRphMultiple).toBe(2.5);
    expect(result.value.escalateRphMultiple).toBe(1.8);
    expect(result.value.cycleIntervalHours).toBe(24);
    expect(result.value.digestTimeHour).toBe(7);
  });

  it("rejects a missing tenantId", () => {
    expect(parseMetaAdsAgentConfig({}).ok).toBe(false);
  });

  it("rejects an empty tenantId", () => {
    expect(parseMetaAdsAgentConfig({ tenantId: "" }).ok).toBe(false);
  });

  it("rejects a non-object input", () => {
    expect(parseMetaAdsAgentConfig("not-an-object").ok).toBe(false);
  });

  it("rejects escalateRphMultiple >= autoExecutePauseRphMultiple", () => {
    const result = parseMetaAdsAgentConfig({
      tenantId: "dss-motor",
      escalateRphMultiple: 2.5,
      autoExecutePauseRphMultiple: 2.5,
    });
    expect(result.ok).toBe(false);
  });

  it("accepts explicit overrides for every field", () => {
    const result = parseMetaAdsAgentConfig({
      tenantId: "dss-motor",
      maxAutoScaleBudgetIDR: 750_000,
      maxAutoReallocationIDR: 3_000_000,
      highSpendThresholdIDR: 1_500_000,
      autoExecutePauseRphMultiple: 3,
      escalateRphMultiple: 2,
      cycleIntervalHours: 12,
      digestTimeHour: 6,
    });
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.maxAutoScaleBudgetIDR).toBe(750_000);
  });

  it("DEFAULT_META_ADS_AGENT_CONFIG matches the spec's exact stated defaults", () => {
    expect(DEFAULT_META_ADS_AGENT_CONFIG).toEqual({
      agentName: "Tamara",
      language: "id",
      maxAutoScaleBudgetIDR: 500_000,
      maxAutoReallocationIDR: 2_000_000,
      highSpendThresholdIDR: 1_000_000,
      autoExecutePauseRphMultiple: 2.5,
      escalateRphMultiple: 1.8,
      cycleIntervalHours: 24,
      digestTimeHour: 7,
      ctwaPhoneNumbers: {},
    });
  });

  it("defaults ctwaPhoneNumbers to {} when not provided (AAOS-W1D-S3)", () => {
    const result = parseMetaAdsAgentConfig({ tenantId: "dss-motor" });
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.ctwaPhoneNumbers).toEqual({});
  });

  it("accepts a ctwaPhoneNumbers map keyed by Branch (AAOS-W1D-S3)", () => {
    const result = parseMetaAdsAgentConfig({
      tenantId: "dss-motor",
      ctwaPhoneNumbers: {
        BINTARO: "+6281100000001",
        CINERE: "+6281100000002",
        UMUM: "+6281100000003",
        BANDUNG: "+6281100000004",
      },
    });
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.ctwaPhoneNumbers.BINTARO).toBe("+6281100000001");
    expect(result.ok && result.value.ctwaPhoneNumbers.BANDUNG).toBe("+6281100000004");
  });

  it("rejects a ctwaPhoneNumbers entry keyed by a non-Branch string", () => {
    const result = parseMetaAdsAgentConfig({
      tenantId: "dss-motor",
      ctwaPhoneNumbers: { NOT_A_BRANCH: "+6281100000001" },
    });
    expect(result.ok).toBe(false);
  });
});

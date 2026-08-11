import { describe, expect, it } from "vitest";

import { mapInsightRowToMetrics } from "../../../src/mappers/MetricsMapper.js";
import type { MetaInsightRow } from "../../../src/types/MetaApiTypes.js";
import { unwrap } from "../../helpers/result.js";

const validRow: MetaInsightRow = {
  spend: "250000",
  impressions: "10000",
  reach: "5000",
  clicks: "100",
  actions: [
    { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "20" },
    { action_type: "onsite_conversion.total_messaging_connection", value: "22" },
    { action_type: "onsite_conversion.lead", value: "2" },
  ],
  messaging_conversation_started: "22",
};

describe("mapInsightRowToMetrics", () => {
  it("maps a well-formed insight row into AdMetrics", () => {
    const metrics = unwrap(mapInsightRowToMetrics(validRow));
    expect(metrics.spend.toNumber()).toBe(250000);
    expect(metrics.impressions).toBe(10000);
    expect(metrics.reach).toBe(5000);
    expect(metrics.clicks).toBe(100);
    expect(metrics.conversations).toBe(22);
    expect(metrics.d3).toBe(20);
    expect(metrics.leadForm).toBe(2);
  });

  it("always defaults d2 and d5 to 0 — documented Meta API limitation", () => {
    const metrics = unwrap(mapInsightRowToMetrics(validRow));
    expect(metrics.d2).toBe(0);
    expect(metrics.d5).toBe(0);
  });

  it("handles an undefined row (ad with no insights at all) as an all-zero AdMetrics", () => {
    const metrics = unwrap(mapInsightRowToMetrics(undefined));
    expect(metrics.spend.isZero()).toBe(true);
    expect(metrics.impressions).toBe(0);
    expect(metrics.reach).toBe(0);
    expect(metrics.clicks).toBe(0);
    expect(metrics.rphD3.value).toBeNull();
  });

  it("defaults spend to 0 when the row omits it", () => {
    const metrics = unwrap(mapInsightRowToMetrics({}));
    expect(metrics.spend.isZero()).toBe(true);
  });

  it("defaults impressions/reach/clicks to 0 for malformed non-numeric strings", () => {
    const metrics = unwrap(
      mapInsightRowToMetrics({ impressions: "not-a-number", reach: "also-bad", clicks: "nope" }),
    );
    expect(metrics.impressions).toBe(0);
    expect(metrics.reach).toBe(0);
    expect(metrics.clicks).toBe(0);
  });

  it("defaults a negative impressions string to 0", () => {
    const metrics = unwrap(mapInsightRowToMetrics({ impressions: "-5" }));
    expect(metrics.impressions).toBe(0);
  });

  it("propagates a Spend validation failure for a negative spend string", () => {
    expect(mapInsightRowToMetrics({ spend: "-100" }).ok).toBe(false);
  });

  it("computes rphD3 safely as null for 0 spend and 0 d3 (edge case)", () => {
    const metrics = unwrap(mapInsightRowToMetrics({ spend: "0" }));
    expect(metrics.rphD3.value).toBeNull();
  });

  it("handles an empty actions array", () => {
    const metrics = unwrap(mapInsightRowToMetrics({ spend: "1000", actions: [] }));
    expect(metrics.d3).toBe(0);
    expect(metrics.conversations).toBe(0);
  });

  it("handles a malformed actions entry without failing the whole mapping", () => {
    const metrics = unwrap(
      mapInsightRowToMetrics({
        spend: "1000",
        actions: [
          {
            action_type: "onsite_conversion.messaging_conversation_started_7d",
            value: "not-a-number",
          },
        ],
      }),
    );
    expect(metrics.d3).toBe(0);
  });
});

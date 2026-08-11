import { describe, expect, it } from "vitest";

import { AdMetrics } from "../../../src/domain/value-objects/AdMetrics.js";
import { Spend } from "../../../src/domain/value-objects/Spend.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function validInput(overrides: Partial<Parameters<typeof AdMetrics.create>[0]> = {}) {
  return {
    spend: unwrap(Spend.create(100_000)),
    impressions: 10_000,
    reach: 5_000,
    clicks: 200,
    conversations: 40,
    d2: 0,
    d3: 20,
    d5: 0,
    leadForm: 5,
    ...overrides,
  };
}

describe("AdMetrics", () => {
  it("computes frequency as impressions / reach", () => {
    const metrics = unwrap(AdMetrics.create(validInput({ impressions: 100, reach: 25 })));
    expect(metrics.frequency).toBe(4);
  });

  it("frequency is safely 0 when reach is 0 (spec edge case: division by zero)", () => {
    const metrics = unwrap(AdMetrics.create(validInput({ impressions: 100, reach: 0 })));
    expect(metrics.frequency).toBe(0);
  });

  it("computes totalLead as d3 + d5 + leadForm", () => {
    const metrics = unwrap(AdMetrics.create(validInput({ d3: 10, d5: 3, leadForm: 2 })));
    expect(metrics.totalLead).toBe(15);
  });

  it("computes rphChat as spend / conversations", () => {
    const metrics = unwrap(
      AdMetrics.create(validInput({ spend: unwrap(Spend.create(40_000)), conversations: 20 })),
    );
    expect(metrics.rphChat.value).toBe(2000);
  });

  it("computes rphD3 as spend / d3 (PRIMARY KPI)", () => {
    const metrics = unwrap(
      AdMetrics.create(validInput({ spend: unwrap(Spend.create(40_000)), d3: 8 })),
    );
    expect(metrics.rphD3.value).toBe(5000);
  });

  it("rphD3 is undefined-safe for a 0-spend ad with 0 d3 (spec edge case)", () => {
    const metrics = unwrap(
      AdMetrics.create(validInput({ spend: Spend.zero(), d3: 0, conversations: 0, leadForm: 0 })),
    );
    expect(metrics.rphD3.value).toBeNull();
    expect(metrics.rphChat.value).toBeNull();
    expect(metrics.rphLead.value).toBeNull();
  });

  it("computes rphLead as spend / totalLead", () => {
    const metrics = unwrap(
      AdMetrics.create(
        validInput({ spend: unwrap(Spend.create(90_000)), d3: 6, d5: 0, leadForm: 3 }),
      ),
    );
    expect(metrics.rphLead.value).toBe(10_000);
  });

  it.each([
    "impressions",
    "reach",
    "clicks",
    "conversations",
    "d2",
    "d3",
    "d5",
    "leadForm",
  ] as const)("rejects a negative %s", (field) => {
    expect(unwrapErr(AdMetrics.create(validInput({ [field]: -1 }))).message).toContain(field);
  });

  it.each([
    "impressions",
    "reach",
    "clicks",
    "conversations",
    "d2",
    "d3",
    "d5",
    "leadForm",
  ] as const)("rejects a non-finite %s", (field) => {
    expect(AdMetrics.create(validInput({ [field]: NaN })).ok).toBe(false);
  });

  it("accepts a fully zeroed ad (0-spend, 0-everything)", () => {
    const metrics = unwrap(
      AdMetrics.create({
        spend: Spend.zero(),
        impressions: 0,
        reach: 0,
        clicks: 0,
        conversations: 0,
        d2: 0,
        d3: 0,
        d5: 0,
        leadForm: 0,
      }),
    );
    expect(metrics.totalLead).toBe(0);
    expect(metrics.frequency).toBe(0);
  });
});

import { describe, expect, it } from "vitest";

import { parseBusinessUseCaseUsage } from "../../../src/infrastructure/meta-api/UsageHeaderParser.js";

describe("parseBusinessUseCaseUsage", () => {
  it("returns undefined for a null header (absent)", () => {
    expect(parseBusinessUseCaseUsage(null)).toBeUndefined();
  });

  it("returns undefined for an empty-string header", () => {
    expect(parseBusinessUseCaseUsage("")).toBeUndefined();
  });

  it("returns undefined for malformed JSON", () => {
    expect(parseBusinessUseCaseUsage("{not valid json")).toBeUndefined();
  });

  it("returns undefined for valid JSON that isn't an object (e.g. a bare number)", () => {
    expect(parseBusinessUseCaseUsage("42")).toBeUndefined();
  });

  it("parses the real documented single-business, single-entry shape", () => {
    const header = JSON.stringify({
      "biz-1": [
        {
          type: "ads_management",
          call_count: 28,
          total_cputime: 25,
          total_time: 25,
          estimated_time_to_regain_access: 0,
        },
      ],
    });
    expect(parseBusinessUseCaseUsage(header)).toEqual({
      maxPercent: 28,
      estimatedTimeToRegainAccessMinutes: 0,
    });
  });

  it("takes the MAX of call_count/total_cputime/total_time across the entry", () => {
    const header = JSON.stringify({
      "biz-1": [{ call_count: 10, total_cputime: 95, total_time: 40 }],
    });
    expect(parseBusinessUseCaseUsage(header)?.maxPercent).toBe(95);
  });

  it("takes the MAX across multiple businesses and multiple entries", () => {
    const header = JSON.stringify({
      "biz-1": [{ call_count: 20 }],
      "biz-2": [{ call_count: 10 }, { total_time: 77 }],
    });
    expect(parseBusinessUseCaseUsage(header)?.maxPercent).toBe(77);
  });

  it("reports a real, nonzero estimated_time_to_regain_access once usage hits 100%", () => {
    const header = JSON.stringify({
      "biz-1": [{ call_count: 100, estimated_time_to_regain_access: 15 }],
    });
    expect(parseBusinessUseCaseUsage(header)).toEqual({
      maxPercent: 100,
      estimatedTimeToRegainAccessMinutes: 15,
    });
  });

  it("takes the MAX estimated_time_to_regain_access across entries", () => {
    const header = JSON.stringify({
      "biz-1": [
        { call_count: 100, estimated_time_to_regain_access: 5 },
        { call_count: 100, estimated_time_to_regain_access: 15 },
      ],
    });
    expect(parseBusinessUseCaseUsage(header)?.estimatedTimeToRegainAccessMinutes).toBe(15);
  });

  it("ignores non-numeric/malformed entry fields rather than throwing", () => {
    const header = JSON.stringify({
      "biz-1": [{ call_count: "not-a-number", total_time: 33 }],
    });
    expect(parseBusinessUseCaseUsage(header)?.maxPercent).toBe(33);
  });

  it("returns undefined for a shape with no usable numeric fields at all (e.g. {})", () => {
    expect(parseBusinessUseCaseUsage(JSON.stringify({}))).toBeUndefined();
    expect(parseBusinessUseCaseUsage(JSON.stringify({ "biz-1": [] }))).toBeUndefined();
    expect(parseBusinessUseCaseUsage(JSON.stringify({ "biz-1": [{ type: "x" }] }))).toBeUndefined();
  });

  it("tolerates a non-array value under a business key without throwing", () => {
    expect(parseBusinessUseCaseUsage(JSON.stringify({ "biz-1": "not-an-array" }))).toBeUndefined();
  });
});

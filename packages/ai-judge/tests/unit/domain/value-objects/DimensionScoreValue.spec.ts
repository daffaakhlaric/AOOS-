import { describe, expect, it } from "vitest";

import { DimensionScoreValue } from "../../../../src/domain/value-objects/DimensionScoreValue.js";

describe("DimensionScoreValue", () => {
  it("keeps an in-range value unchanged", () => {
    expect(DimensionScoreValue.of(7).value).toBe(7);
  });

  it("clamps a value above 10 down to 10", () => {
    expect(DimensionScoreValue.of(15).value).toBe(10);
  });

  it("clamps a negative value up to 0", () => {
    expect(DimensionScoreValue.of(-5).value).toBe(0);
  });

  it("clamps exactly at the boundaries", () => {
    expect(DimensionScoreValue.of(0).value).toBe(0);
    expect(DimensionScoreValue.of(10).value).toBe(10);
  });

  it("toNumber() matches value", () => {
    const dsv = DimensionScoreValue.of(6.5);
    expect(dsv.toNumber()).toBe(dsv.value);
  });
});

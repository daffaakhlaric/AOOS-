import { describe, expect, it } from "vitest";

import { createSeasonalPattern } from "../../../../src/domain/value-objects/SeasonalPattern.js";

describe("createSeasonalPattern", () => {
  it("builds a map from valid hour/index entries", () => {
    const pattern = createSeasonalPattern([
      [9, 1.4],
      [20, 2.1],
    ]);
    expect(pattern.get(9)).toBe(1.4);
    expect(pattern.get(20)).toBe(2.1);
    expect(pattern.size).toBe(2);
  });

  it("drops out-of-range hour keys", () => {
    const pattern = createSeasonalPattern([
      [-1, 1],
      [24, 1],
      [9, 1.4],
    ]);
    expect(pattern.size).toBe(1);
    expect(pattern.get(9)).toBe(1.4);
  });

  it("drops non-integer hour keys and non-finite index values", () => {
    const pattern = createSeasonalPattern([
      [9.5, 1],
      [10, Number.NaN],
      [11, 1.2],
    ]);
    expect(pattern.size).toBe(1);
    expect(pattern.get(11)).toBe(1.2);
  });

  it("returns an empty map for no entries", () => {
    expect(createSeasonalPattern([]).size).toBe(0);
  });
});

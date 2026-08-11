import { describe, expect, it } from "vitest";

import { pickFromPool } from "../../../src/responses/PoolSelector.js";

describe("pickFromPool", () => {
  const pool = ["a", "b", "c"] as const;

  it("selects deterministically for the same seed", () => {
    expect(pickFromPool(pool, 1)).toBe(pickFromPool(pool, 1));
  });

  it("wraps around via modulo for a seed beyond the pool length", () => {
    expect(pickFromPool(pool, 3)).toBe(pool[0]);
    expect(pickFromPool(pool, 4)).toBe(pool[1]);
  });

  it("handles a negative seed via abs()", () => {
    expect(pickFromPool(pool, -1)).toBe(pool[1]);
  });

  it("handles a fractional seed via trunc()", () => {
    expect(pickFromPool(pool, 1.9)).toBe(pool[1]);
  });

  it("seed 0 selects the first element", () => {
    expect(pickFromPool(pool, 0)).toBe(pool[0]);
  });
});

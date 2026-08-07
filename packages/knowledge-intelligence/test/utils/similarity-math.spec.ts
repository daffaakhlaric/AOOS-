import { describe, expect, it } from "vitest";

import {
  cosineSimilarity,
  jaccardIndex,
  sharedElementCount,
} from "../../src/utils/similarity-math.js";

describe("jaccardIndex", () => {
  it("computes the exact Jaccard index for a known pair", () => {
    // A = {a,b,c}, B = {b,c,d} -> intersection {b,c} = 2, union {a,b,c,d} = 4 -> 0.5
    expect(jaccardIndex(["a", "b", "c"], ["b", "c", "d"])).toBeCloseTo(0.5, 10);
  });

  it("returns 1 for identical sets", () => {
    expect(jaccardIndex(["x", "y"], ["y", "x"])).toBe(1);
  });

  it("returns 0 for fully disjoint sets", () => {
    expect(jaccardIndex(["a", "b"], ["c", "d"])).toBe(0);
  });

  it("returns 1 for two empty sets", () => {
    expect(jaccardIndex([], [])).toBe(1);
  });

  it("returns 0 when one set is empty and the other is not", () => {
    expect(jaccardIndex([], ["a"])).toBe(0);
    expect(jaccardIndex(["a"], [])).toBe(0);
  });

  it("is case-insensitive", () => {
    expect(jaccardIndex(["Alpha"], ["alpha"])).toBe(1);
  });

  it("de-duplicates repeated elements within a set", () => {
    expect(jaccardIndex(["a", "a", "b"], ["a", "b", "b"])).toBe(1);
  });

  it("trims whitespace and ignores blank entries", () => {
    expect(jaccardIndex([" a ", ""], ["a"])).toBe(1);
  });

  it("computes a known partial-overlap case exactly", () => {
    // A = {tag1,tag2,tag3,tag4}, B = {tag3,tag4,tag5} -> intersection 2, union 5 -> 0.4
    expect(jaccardIndex(["tag1", "tag2", "tag3", "tag4"], ["tag3", "tag4", "tag5"])).toBeCloseTo(
      0.4,
      10,
    );
  });
});

describe("jaccardIndex — known-pair table", () => {
  it.each<[readonly string[], readonly string[], number]>([
    [["a"], ["a"], 1],
    [["a", "b"], ["a", "b"], 1],
    [["a", "b", "c"], ["a"], 1 / 3],
    [["a", "b", "c"], ["a", "b"], 2 / 3],
    [["a", "b", "c", "d"], ["c", "d", "e", "f"], 2 / 6],
    [["a", "b", "c", "d", "e"], ["a", "b", "c", "d", "f"], 4 / 6],
    [["x"], ["y"], 0],
    [["x", "y"], ["x", "z"], 1 / 3],
    [["p", "q", "r", "s"], ["p", "q", "r", "s", "t", "u"], 4 / 6],
    [["m", "n"], ["m", "n", "o", "p"], 2 / 4],
  ])("jaccardIndex(%j, %j) === %p", (a, b, expected) => {
    expect(jaccardIndex(a, b)).toBeCloseTo(expected, 10);
  });
});

describe("cosineSimilarity", () => {
  it("computes the exact cosine similarity for a known pair", () => {
    // (1,0) vs (0,1) are orthogonal -> 0
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 10);
  });

  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
  });

  it("returns 1 for parallel vectors of different magnitude", () => {
    expect(cosineSimilarity([1, 2], [2, 4])).toBeCloseTo(1, 10);
  });

  it("returns -1 for exactly opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 10);
  });

  it("returns 1 for two zero vectors", () => {
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(1);
  });

  it("returns 0 when only one vector is zero", () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });

  it("throws when vectors have different lengths", () => {
    expect(() => cosineSimilarity([1, 2], [1])).toThrow(RangeError);
  });

  it("computes a known 3-dimensional case exactly", () => {
    // (1,1,0) . (1,0,0) = 1; |(1,1,0)| = sqrt(2); |(1,0,0)| = 1 -> 1/sqrt(2)
    expect(cosineSimilarity([1, 1, 0], [1, 0, 0])).toBeCloseTo(1 / Math.sqrt(2), 10);
  });
});

describe("cosineSimilarity — known-vector table", () => {
  it.each<[readonly number[], readonly number[], number]>([
    [[1, 0, 0], [1, 0, 0], 1],
    [[1, 0, 0], [0, 1, 0], 0],
    [[1, 1, 1], [1, 1, 1], 1],
    [[2, 0], [3, 0], 1],
    [[1, 2, 3], [4, 5, 6], 32 / (Math.sqrt(14) * Math.sqrt(77))],
    [[1, -1], [1, -1], 1],
    [[1, -1], [-1, 1], -1],
    [[3, 4], [3, 4], 1],
    [[0, 1], [1, 0], 0],
  ])("cosineSimilarity(%j, %j) === %p", (a, b, expected) => {
    expect(cosineSimilarity(a, b)).toBeCloseTo(expected, 10);
  });
});

describe("sharedElementCount", () => {
  it("counts overlapping elements case-insensitively", () => {
    expect(sharedElementCount(["A", "b", "c"], ["a", "B", "d"])).toBe(2);
  });

  it("returns 0 for disjoint arrays", () => {
    expect(sharedElementCount(["a"], ["b"])).toBe(0);
  });

  it("de-duplicates before counting", () => {
    expect(sharedElementCount(["a", "a", "b"], ["a"])).toBe(1);
  });

  it("returns 0 for two empty arrays", () => {
    expect(sharedElementCount([], [])).toBe(0);
  });
});

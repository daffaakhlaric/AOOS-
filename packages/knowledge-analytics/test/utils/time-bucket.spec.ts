import { describe, expect, it } from "vitest";

import {
  bucketByInterval,
  calculatePeriodOverPeriodDelta,
  calculateTrendSlope,
  type TimestampedValue,
} from "../../src/utils/time-bucket.js";

/**
 * Known dataset: bucketSizeMs=1000, origin=0.
 *   bucket0 [0,1000): timestamps 0,500 -> values 10,20 -> average 15
 *   bucket1 [1000,2000): timestamps 1000,1500 -> values 30,40 -> average 35
 *   bucket2 [2000,3000): timestamp 2000 -> value 50 -> average 50
 */
const KNOWN_SAMPLES: readonly TimestampedValue[] = [
  { timestamp: 0, value: 10 },
  { timestamp: 500, value: 20 },
  { timestamp: 1000, value: 30 },
  { timestamp: 1500, value: 40 },
  { timestamp: 2000, value: 50 },
];

describe("bucketByInterval", () => {
  it("returns an empty array for no samples", () => {
    expect(bucketByInterval([], 1000)).toEqual([]);
  });

  it("groups samples into the expected number of buckets", () => {
    expect(bucketByInterval(KNOWN_SAMPLES, 1000)).toHaveLength(3);
  });

  it("computes each bucket's average exactly", () => {
    const buckets = bucketByInterval(KNOWN_SAMPLES, 1000);
    expect(buckets.map((b) => b.average)).toEqual([15, 35, 50]);
  });

  it("computes each bucket's sample count exactly", () => {
    const buckets = bucketByInterval(KNOWN_SAMPLES, 1000);
    expect(buckets.map((b) => b.count)).toEqual([2, 2, 1]);
  });

  it("anchors buckets at the earliest sample's timestamp", () => {
    const buckets = bucketByInterval(KNOWN_SAMPLES, 1000);
    expect(buckets[0]!.start).toBe(0);
    expect(buckets[0]!.end).toBe(1000);
  });

  it("does not require samples to be pre-sorted", () => {
    const shuffled = [...KNOWN_SAMPLES].reverse();
    expect(bucketByInterval(shuffled, 1000).map((b) => b.average)).toEqual([15, 35, 50]);
  });

  it("handles a non-zero origin", () => {
    const samples = [
      { timestamp: 5000, value: 1 },
      { timestamp: 5500, value: 3 },
    ];
    const buckets = bucketByInterval(samples, 1000);
    expect(buckets).toHaveLength(1);
    expect(buckets[0]!.start).toBe(5000);
    expect(buckets[0]!.average).toBe(2);
  });

  it("throws RangeError for a non-positive bucketSizeMs", () => {
    expect(() => bucketByInterval(KNOWN_SAMPLES, 0)).toThrow(RangeError);
    expect(() => bucketByInterval(KNOWN_SAMPLES, -100)).toThrow(RangeError);
  });
});

describe("calculateTrendSlope", () => {
  it("returns 0 for fewer than 2 buckets", () => {
    expect(calculateTrendSlope([])).toBe(0);
    expect(calculateTrendSlope(bucketByInterval([{ timestamp: 0, value: 5 }], 1000))).toBe(0);
  });

  it("computes the exact OLS slope for the known dataset (17.5)", () => {
    const buckets = bucketByInterval(KNOWN_SAMPLES, 1000);
    expect(calculateTrendSlope(buckets)).toBeCloseTo(17.5, 10);
  });

  it("returns 0 for a perfectly flat series", () => {
    const flatSamples: TimestampedValue[] = [
      { timestamp: 0, value: 10 },
      { timestamp: 1000, value: 10 },
      { timestamp: 2000, value: 10 },
    ];
    const buckets = bucketByInterval(flatSamples, 1000);
    expect(calculateTrendSlope(buckets)).toBe(0);
  });

  it("returns a negative slope for a declining series", () => {
    const decliningSamples: TimestampedValue[] = [
      { timestamp: 0, value: 100 },
      { timestamp: 1000, value: 50 },
      { timestamp: 2000, value: 0 },
    ];
    const buckets = bucketByInterval(decliningSamples, 1000);
    expect(calculateTrendSlope(buckets)).toBeCloseTo(-50, 10);
  });
});

describe("calculatePeriodOverPeriodDelta", () => {
  it("returns 0 for fewer than 2 buckets", () => {
    expect(calculatePeriodOverPeriodDelta([])).toBe(0);
  });

  it("computes the exact delta for the known dataset (15/35)", () => {
    const buckets = bucketByInterval(KNOWN_SAMPLES, 1000);
    expect(calculatePeriodOverPeriodDelta(buckets)).toBeCloseTo(15 / 35, 10);
  });

  it("returns 0 when the previous bucket's average is 0", () => {
    const samples: TimestampedValue[] = [
      { timestamp: 0, value: 0 },
      { timestamp: 1000, value: 10 },
    ];
    const buckets = bucketByInterval(samples, 1000);
    expect(calculatePeriodOverPeriodDelta(buckets)).toBe(0);
  });

  it("computes a negative delta for a decline", () => {
    const samples: TimestampedValue[] = [
      { timestamp: 0, value: 100 },
      { timestamp: 1000, value: 50 },
    ];
    const buckets = bucketByInterval(samples, 1000);
    expect(calculatePeriodOverPeriodDelta(buckets)).toBeCloseTo(-0.5, 10);
  });
});

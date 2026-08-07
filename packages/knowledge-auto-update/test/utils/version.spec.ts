import { describe, expect, it } from "vitest";

import { compareVersions, isValidVersion } from "../../src/utils/version.js";

describe("compareVersions", () => {
  it("returns 0 for equal versions", () => {
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
  });

  it("orders by major version", () => {
    expect(compareVersions("2.0.0", "1.9.9")).toBeGreaterThan(0);
    expect(compareVersions("1.9.9", "2.0.0")).toBeLessThan(0);
  });

  it("orders by minor version when major is equal", () => {
    expect(compareVersions("1.2.0", "1.1.9")).toBeGreaterThan(0);
  });

  it("orders by patch version when major/minor are equal", () => {
    expect(compareVersions("1.2.3", "1.2.4")).toBeLessThan(0);
  });

  it("treats missing trailing segments as 0", () => {
    expect(compareVersions("1.2", "1.2.0")).toBe(0);
    expect(compareVersions("1", "1.0.0")).toBe(0);
  });

  it("treats missing trailing segments as 0 on the right-hand side too", () => {
    expect(compareVersions("1.2.0", "1.2")).toBe(0);
    expect(compareVersions("1.2.1", "1.2")).toBeGreaterThan(0);
  });

  it("treats a prerelease version as lower precedence than the release", () => {
    expect(compareVersions("1.0.0-alpha", "1.0.0")).toBeLessThan(0);
    expect(compareVersions("1.0.0", "1.0.0-alpha")).toBeGreaterThan(0);
  });

  it("compares two prerelease suffixes lexically", () => {
    expect(compareVersions("1.0.0-alpha", "1.0.0-beta")).toBeLessThan(0);
    expect(compareVersions("1.0.0-beta", "1.0.0-alpha")).toBeGreaterThan(0);
  });

  it("returns 0 for identical prerelease versions", () => {
    expect(compareVersions("1.0.0-rc1", "1.0.0-rc1")).toBe(0);
  });

  it("supports more than 3 numeric segments", () => {
    expect(compareVersions("1.2.3.4", "1.2.3.5")).toBeLessThan(0);
  });

  it("throws on non-numeric core segments", () => {
    expect(() => compareVersions("1.x.0", "1.0.0")).toThrow(TypeError);
  });
});

describe("compareVersions — parameterized ordering table", () => {
  const orderedAscending = [
    "0.0.1",
    "0.1.0",
    "0.9.9",
    "1.0.0-alpha",
    "1.0.0-beta",
    "1.0.0",
    "1.0.1",
    "1.2.3",
    "2.0.0",
    "10.0.0",
  ];

  it.each(orderedAscending.slice(1).map((v, i) => [orderedAscending[i], v] as const))(
    "%s is less than %s",
    (lower, higher) => {
      expect(compareVersions(lower, higher)).toBeLessThan(0);
      expect(compareVersions(higher, lower)).toBeGreaterThan(0);
    },
  );

  it("the full ascending list sorts back to itself via compareVersions", () => {
    const shuffled = [...orderedAscending].reverse();
    expect(shuffled.sort(compareVersions)).toEqual(orderedAscending);
  });
});

describe("isValidVersion", () => {
  it("accepts a standard 3-segment version", () => {
    expect(isValidVersion("1.2.3")).toBe(true);
  });

  it("accepts a version with a prerelease suffix", () => {
    expect(isValidVersion("1.2.3-beta.1")).toBe(true);
  });

  it("accepts a single-segment version", () => {
    expect(isValidVersion("5")).toBe(true);
  });

  it("rejects a non-numeric core segment", () => {
    expect(isValidVersion("1.x.0")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidVersion("")).toBe(false);
  });
});

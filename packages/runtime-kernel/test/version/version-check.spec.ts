import { describe, expect, it } from "vitest";

import { KernelException } from "../../src/errors/index.js";
import { compareVersions, isVersionCompatible } from "../../src/version/version-check.js";
import { getUptimeMs, KERNEL_VERSION } from "../../src/version/version-info.js";

describe("isVersionCompatible", () => {
  it("returns true when the version satisfies the range", () => {
    expect(isVersionCompatible("1.2.3", "^1.0.0")).toBe(true);
  });

  it("returns false when the version does not satisfy the range", () => {
    expect(isVersionCompatible("2.0.0", "^1.0.0")).toBe(false);
  });

  it("throws KernelException for an invalid version string", () => {
    expect(() => isVersionCompatible("not-a-version", "^1.0.0")).toThrow(KernelException);
  });

  it("throws KernelException for an invalid range string", () => {
    expect(() => isVersionCompatible("1.0.0", "not-a-range")).toThrow(KernelException);
  });
});

describe("compareVersions", () => {
  it("returns -1, 0, 1 correctly", () => {
    expect(compareVersions("1.0.0", "2.0.0")).toBe(-1);
    expect(compareVersions("2.0.0", "2.0.0")).toBe(0);
    expect(compareVersions("3.0.0", "2.0.0")).toBe(1);
  });
});

describe("version-info", () => {
  it("KERNEL_VERSION matches package.json's version field", () => {
    expect(KERNEL_VERSION).toBe("0.1.0");
  });

  it("getUptimeMs returns a non-negative elapsed duration", () => {
    const startedAt = new Date(Date.now() - 50);
    expect(getUptimeMs(startedAt)).toBeGreaterThanOrEqual(50);
  });
});

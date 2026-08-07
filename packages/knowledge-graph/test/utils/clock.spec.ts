import { afterEach, describe, expect, it, vi } from "vitest";

import { highResolutionNow, now } from "../../src/utils/clock.js";

describe("clock", () => {
  it("now() returns a positive epoch-millisecond timestamp", () => {
    const timestamp = now();
    expect(typeof timestamp).toBe("number");
    expect(timestamp).toBeGreaterThan(0);
  });

  it("highResolutionNow() returns a non-negative number", () => {
    const value = highResolutionNow();
    expect(typeof value).toBe("number");
    expect(value).toBeGreaterThanOrEqual(0);
  });

  it("highResolutionNow() is monotonically non-decreasing across two calls", () => {
    const first = highResolutionNow();
    const second = highResolutionNow();
    expect(second).toBeGreaterThanOrEqual(first);
  });

  describe("without a global performance object", () => {
    const originalPerformance = globalThis.performance;

    afterEach(() => {
      vi.stubGlobal("performance", originalPerformance);
    });

    it("falls back to Date.now()", () => {
      vi.stubGlobal("performance", undefined);
      const value = highResolutionNow();
      expect(typeof value).toBe("number");
      expect(value).toBeGreaterThan(0);
    });
  });
});

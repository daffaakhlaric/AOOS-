import { describe, expect, it, vi } from "vitest";

import { generateId, measureDurationMs, now, safeInvoke } from "../../src/utils/index.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("generateId", () => {
  it("produces a valid, unique UUID each call", () => {
    const a = generateId();
    const b = generateId();
    expect(a).toMatch(UUID_PATTERN);
    expect(a).not.toBe(b);
  });
});

describe("now / measureDurationMs", () => {
  it("now() returns a monotonically non-decreasing value", () => {
    const a = now();
    const b = now();
    expect(b).toBeGreaterThanOrEqual(a);
  });

  it("measureDurationMs returns the function's result and a non-negative duration", async () => {
    const { result, durationMs } = await measureDurationMs(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return "done";
    });
    expect(result).toBe("done");
    expect(durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe("safeInvoke", () => {
  it("returns undefined when no function is provided", async () => {
    expect(await safeInvoke(undefined)).toBeUndefined();
  });

  it("awaits and returns the function's result when provided", async () => {
    const fn = vi.fn().mockResolvedValue(42);
    expect(await safeInvoke(fn)).toBe(42);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("supports synchronous functions too", async () => {
    expect(await safeInvoke(() => "sync")).toBe("sync");
  });
});

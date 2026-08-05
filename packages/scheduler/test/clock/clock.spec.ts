import { describe, expect, it } from "vitest";

import { MockClock } from "../../src/clock/mock-clock.js";
import { SystemClock } from "../../src/clock/system-clock.js";

describe("Clock Test — SystemClock", () => {
  it("returns a Date close to the real wall clock", () => {
    const before = Date.now();
    const now = new SystemClock().now().getTime();
    const after = Date.now();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(after);
  });
});

describe("Clock Test — MockClock", () => {
  it("defaults to the Unix epoch", () => {
    expect(new MockClock().now().toISOString()).toBe("1970-01-01T00:00:00.000Z");
  });

  it("accepts an initial Date or ISO string", () => {
    expect(new MockClock("2026-01-01T00:00:00.000Z").now().toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
    expect(new MockClock(new Date("2026-06-01T00:00:00.000Z")).now().toISOString()).toBe(
      "2026-06-01T00:00:00.000Z",
    );
  });

  it("set() replaces the current time", () => {
    const clock = new MockClock("2026-01-01T00:00:00.000Z");
    clock.set("2026-02-01T00:00:00.000Z");
    expect(clock.now().toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });

  it("set() accepts a Date instance", () => {
    const clock = new MockClock();
    clock.set(new Date("2026-03-01T00:00:00.000Z"));
    expect(clock.now().toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("advanceMs() moves time forward by the given delta", () => {
    const clock = new MockClock("2026-01-01T00:00:00.000Z");
    clock.advanceMs(60_000);
    expect(clock.now().toISOString()).toBe("2026-01-01T00:01:00.000Z");
  });

  it("now() returns a fresh Date instance each call (not a shared mutable reference)", () => {
    const clock = new MockClock("2026-01-01T00:00:00.000Z");
    const first = clock.now();
    first.setFullYear(2000);
    expect(clock.now().getFullYear()).toBe(2026);
  });
});

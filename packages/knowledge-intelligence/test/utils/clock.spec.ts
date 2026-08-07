import { describe, expect, it } from "vitest";

import { ManualClock, SystemClock } from "../../src/utils/clock.js";

describe("SystemClock", () => {
  it("returns a real wall-clock timestamp close to Date.now()", () => {
    const clock = new SystemClock();
    const before = Date.now();
    const value = clock.now();
    const after = Date.now();
    expect(value).toBeGreaterThanOrEqual(before);
    expect(value).toBeLessThanOrEqual(after);
  });
});

describe("ManualClock", () => {
  it("defaults to 0 when no startAt is given", () => {
    expect(new ManualClock().now()).toBe(0);
  });

  it("starts at the given timestamp", () => {
    expect(new ManualClock(500).now()).toBe(500);
  });

  it("advances by the given amount", () => {
    const clock = new ManualClock(100);
    expect(clock.advance(50)).toBe(150);
    expect(clock.now()).toBe(150);
  });

  it("throws when advancing by a negative amount", () => {
    const clock = new ManualClock(0);
    expect(() => clock.advance(-1)).toThrow(RangeError);
  });

  it("allows advancing by zero", () => {
    const clock = new ManualClock(10);
    expect(clock.advance(0)).toBe(10);
  });

  it("sets an absolute timestamp", () => {
    const clock = new ManualClock(0);
    clock.set(999);
    expect(clock.now()).toBe(999);
  });
});

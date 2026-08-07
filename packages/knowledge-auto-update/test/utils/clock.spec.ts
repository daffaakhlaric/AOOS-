import { describe, expect, it } from "vitest";

import { ManualClock, SystemClock } from "../../src/utils/clock.js";

describe("SystemClock", () => {
  it("returns a number close to real wall-clock time", () => {
    const clock = new SystemClock();
    const before = Date.now();
    const now = clock.now();
    const after = Date.now();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(after);
  });
});

describe("ManualClock", () => {
  it("starts at 0 by default", () => {
    expect(new ManualClock().now()).toBe(0);
  });

  it("starts at the given timestamp", () => {
    expect(new ManualClock(1000).now()).toBe(1000);
  });

  it("advances by the given amount", () => {
    const clock = new ManualClock(100);
    expect(clock.advance(50)).toBe(150);
    expect(clock.now()).toBe(150);
  });

  it("never advances on its own across repeated now() calls", () => {
    const clock = new ManualClock(5);
    expect(clock.now()).toBe(5);
    expect(clock.now()).toBe(5);
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
    clock.set(9999);
    expect(clock.now()).toBe(9999);
  });

  it("allows setting to an earlier timestamp than current", () => {
    const clock = new ManualClock(500);
    clock.set(10);
    expect(clock.now()).toBe(10);
  });
});

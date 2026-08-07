import { describe, expect, it } from "vitest";

import { createFixedClock, createSteppingClock, systemClock } from "../../src/utils/clock.js";

describe("systemClock", () => {
  it("returns a number close to Date.now()", () => {
    const before = Date.now();
    const value = systemClock();
    const after = Date.now();
    expect(value).toBeGreaterThanOrEqual(before);
    expect(value).toBeLessThanOrEqual(after);
  });
});

describe("createFixedClock", () => {
  it("always returns the same timestamp", () => {
    const clock = createFixedClock(1000);
    expect(clock()).toBe(1000);
    expect(clock()).toBe(1000);
    expect(clock()).toBe(1000);
  });
});

describe("createSteppingClock", () => {
  it("returns startAt on the first call", () => {
    const clock = createSteppingClock(1000, 10);
    expect(clock()).toBe(1000);
  });

  it("advances by stepMs on each subsequent call", () => {
    const clock = createSteppingClock(1000, 10);
    expect(clock()).toBe(1000);
    expect(clock()).toBe(1010);
    expect(clock()).toBe(1020);
  });

  it("supports a zero step (constant time)", () => {
    const clock = createSteppingClock(500, 0);
    expect(clock()).toBe(500);
    expect(clock()).toBe(500);
  });
});

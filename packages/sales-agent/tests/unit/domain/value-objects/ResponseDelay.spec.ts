import { describe, expect, it } from "vitest";

import { ResponseDelay } from "../../../../src/domain/value-objects/ResponseDelay.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("ResponseDelay", () => {
  it("create() accepts a non-negative number", () => {
    expect(unwrap(ResponseDelay.create(1000)).toMilliseconds()).toBe(1000);
  });

  it("create() rounds a fractional value", () => {
    expect(unwrap(ResponseDelay.create(1000.6)).toMilliseconds()).toBe(1001);
  });

  it("create() rejects a negative value", () => {
    expect(unwrapErr(ResponseDelay.create(-1)).message).toContain("non-negative");
  });

  it("create() rejects NaN", () => {
    expect(unwrapErr(ResponseDelay.create(Number.NaN)).message).toContain("non-negative");
  });

  it("fromSeed() is deterministic for the same seed", () => {
    const a = ResponseDelay.fromSeed(3, 800, 3000);
    const b = ResponseDelay.fromSeed(3, 800, 3000);
    expect(a.toMilliseconds()).toBe(b.toMilliseconds());
  });

  it("fromSeed() always stays within [minMs, maxMs]", () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const delay = ResponseDelay.fromSeed(seed, 800, 3000).toMilliseconds();
      expect(delay).toBeGreaterThanOrEqual(800);
      expect(delay).toBeLessThanOrEqual(3000);
    }
  });

  it("fromSeed() handles a negative seed via abs()", () => {
    const delay = ResponseDelay.fromSeed(-5, 800, 3000).toMilliseconds();
    expect(delay).toBeGreaterThanOrEqual(800);
    expect(delay).toBeLessThanOrEqual(3000);
  });

  it("fromSeed() handles minMs === maxMs (zero span)", () => {
    expect(ResponseDelay.fromSeed(7, 1000, 1000).toMilliseconds()).toBe(1000);
  });
});

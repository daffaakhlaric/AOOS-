import { describe, expect, it } from "vitest";

import { ForecastScore } from "../../../../src/domain/value-objects/ForecastScore.js";
import { unwrap } from "../../../helpers/result.js";

describe("ForecastScore", () => {
  it("creates a valid non-negative integer", () => {
    expect(unwrap(ForecastScore.create(46)).toNumber()).toBe(46);
  });

  it("creates zero", () => {
    expect(unwrap(ForecastScore.create(0)).toNumber()).toBe(0);
  });

  it("rejects a negative value", () => {
    expect(ForecastScore.create(-1).ok).toBe(false);
  });

  it("rejects a non-integer", () => {
    expect(ForecastScore.create(46.5).ok).toBe(false);
  });

  it("rejects NaN", () => {
    expect(ForecastScore.create(NaN).ok).toBe(false);
  });

  it("rejects Infinity", () => {
    expect(ForecastScore.create(Infinity).ok).toBe(false);
  });

  it("rejects a non-number", () => {
    expect(ForecastScore.create("46" as unknown as number).ok).toBe(false);
  });

  it("equals compares values", () => {
    const a = unwrap(ForecastScore.create(46));
    const b = unwrap(ForecastScore.create(46));
    const c = unwrap(ForecastScore.create(50));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});

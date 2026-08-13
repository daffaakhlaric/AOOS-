import { describe, expect, it } from "vitest";

import { EmqScore } from "../../../../src/domain/value-objects/EmqScore.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("EmqScore", () => {
  it.each([0, 5, 8.3, 10])("accepts %s (within [0, 10])", (score) => {
    const emqScore = unwrap(EmqScore.create(score));
    expect(emqScore.value).toBe(score);
  });

  it("rejects a negative score", () => {
    const error = unwrapErr(EmqScore.create(-0.1));
    expect(error.message).toContain("EmqScore must be within [0, 10]");
  });

  it("rejects a score above 10", () => {
    expect(EmqScore.create(10.1).ok).toBe(false);
  });

  it("rejects NaN/Infinity", () => {
    expect(EmqScore.create(Number.NaN).ok).toBe(false);
    expect(EmqScore.create(Number.POSITIVE_INFINITY).ok).toBe(false);
  });
});

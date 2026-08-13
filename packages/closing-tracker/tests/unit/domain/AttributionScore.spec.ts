import { describe, expect, it } from "vitest";

import { AttributionScore } from "../../../src/domain/value-objects/AttributionScore.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("AttributionScore", () => {
  it("rejects a score above 100", () => {
    const error = unwrapErr(AttributionScore.create(101));
    expect(error.message).toContain("0 and 100");
  });

  it("rejects a negative score", () => {
    const error = unwrapErr(AttributionScore.create(-1));
    expect(error.message).toContain("0 and 100");
  });

  it("accepts the 0 and 100 boundaries", () => {
    expect(unwrap(AttributionScore.create(0)).value).toBe(0);
    expect(unwrap(AttributionScore.create(100)).value).toBe(100);
  });

  it("direct() -> 100 (Method 1 confidence)", () => {
    expect(AttributionScore.direct().value).toBe(100);
  });

  it("timeBased() -> 70 (Method 2 confidence)", () => {
    expect(AttributionScore.timeBased().value).toBe(70);
  });

  it("branchBased() -> 40 (Method 3 confidence)", () => {
    expect(AttributionScore.branchBased().value).toBe(40);
  });

  it("exposes the 3 raw constants matching the spec's Attribution Engine", () => {
    expect(AttributionScore.DIRECT).toBe(100);
    expect(AttributionScore.TIME_BASED).toBe(70);
    expect(AttributionScore.BRANCH_BASED).toBe(40);
  });
});

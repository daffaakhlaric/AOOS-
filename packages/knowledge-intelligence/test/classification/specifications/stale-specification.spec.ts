import { beforeEach, describe, expect, it } from "vitest";

import { StaleSpecification } from "../../../src/classification/specifications/stale-specification.js";
import { resetFixtureState, makeClock, makeItem } from "../../helpers/fixtures.js";

describe("StaleSpecification", () => {
  beforeEach(() => resetFixtureState());

  it("is satisfied when age exceeds maxAgeMs", () => {
    const clock = makeClock(10_000);
    const spec = new StaleSpecification(clock, 5000);
    expect(spec.isSatisfiedBy(makeItem({ lastUpdatedAt: 0 }))).toBe(true);
  });

  it("is not satisfied when age is within maxAgeMs", () => {
    const clock = makeClock(1000);
    const spec = new StaleSpecification(clock, 5000);
    expect(spec.isSatisfiedBy(makeItem({ lastUpdatedAt: 0 }))).toBe(false);
  });
});

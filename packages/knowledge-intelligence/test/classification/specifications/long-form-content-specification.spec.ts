import { beforeEach, describe, expect, it } from "vitest";

import { LongFormContentSpecification } from "../../../src/classification/specifications/long-form-content-specification.js";
import { resetFixtureState, makeItem } from "../../helpers/fixtures.js";

describe("LongFormContentSpecification", () => {
  beforeEach(() => resetFixtureState());

  it("is satisfied when contentLength meets the minimum", () => {
    const spec = new LongFormContentSpecification(2000);
    expect(spec.isSatisfiedBy(makeItem({ contentLength: 2000 }))).toBe(true);
    expect(spec.isSatisfiedBy(makeItem({ contentLength: 3000 }))).toBe(true);
  });

  it("is not satisfied when contentLength is below the minimum", () => {
    const spec = new LongFormContentSpecification(2000);
    expect(spec.isSatisfiedBy(makeItem({ contentLength: 1999 }))).toBe(false);
  });
});

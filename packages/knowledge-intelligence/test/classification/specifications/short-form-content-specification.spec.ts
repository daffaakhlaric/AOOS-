import { beforeEach, describe, expect, it } from "vitest";

import { ShortFormContentSpecification } from "../../../src/classification/specifications/short-form-content-specification.js";
import { resetFixtureState, makeItem } from "../../helpers/fixtures.js";

describe("ShortFormContentSpecification", () => {
  beforeEach(() => resetFixtureState());

  it("is satisfied when contentLength is at or below the maximum", () => {
    const spec = new ShortFormContentSpecification(200);
    expect(spec.isSatisfiedBy(makeItem({ contentLength: 200 }))).toBe(true);
    expect(spec.isSatisfiedBy(makeItem({ contentLength: 100 }))).toBe(true);
  });

  it("is not satisfied when contentLength exceeds the maximum", () => {
    const spec = new ShortFormContentSpecification(200);
    expect(spec.isSatisfiedBy(makeItem({ contentLength: 201 }))).toBe(false);
  });
});

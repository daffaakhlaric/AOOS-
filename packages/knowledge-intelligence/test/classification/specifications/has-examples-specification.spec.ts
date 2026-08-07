import { beforeEach, describe, expect, it } from "vitest";

import { HasExamplesSpecification } from "../../../src/classification/specifications/has-examples-specification.js";
import { resetFixtureState, makeItem } from "../../helpers/fixtures.js";

describe("HasExamplesSpecification", () => {
  beforeEach(() => resetFixtureState());

  it("is satisfied when hasExamples is true", () => {
    expect(new HasExamplesSpecification().isSatisfiedBy(makeItem({ hasExamples: true }))).toBe(
      true,
    );
  });

  it("is not satisfied when hasExamples is false", () => {
    expect(new HasExamplesSpecification().isSatisfiedBy(makeItem({ hasExamples: false }))).toBe(
      false,
    );
  });
});

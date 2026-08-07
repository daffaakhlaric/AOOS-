import { beforeEach, describe, expect, it } from "vitest";

import { HasCategoryHintSpecification } from "../../../src/classification/specifications/has-category-hint-specification.js";
import { resetFixtureState, makeItem } from "../../helpers/fixtures.js";

describe("HasCategoryHintSpecification", () => {
  beforeEach(() => resetFixtureState());

  it("is satisfied when the category hint matches (case-insensitively)", () => {
    const spec = new HasCategoryHintSpecification("Reference");
    expect(spec.isSatisfiedBy(makeItem({ category: "reference" }))).toBe(true);
  });

  it("is not satisfied when the category hint differs", () => {
    const spec = new HasCategoryHintSpecification("reference");
    expect(spec.isSatisfiedBy(makeItem({ category: "how_to" }))).toBe(false);
  });

  it("is not satisfied when no category hint is present", () => {
    const spec = new HasCategoryHintSpecification("reference");
    expect(spec.isSatisfiedBy(makeItem({ category: undefined }))).toBe(false);
  });
});

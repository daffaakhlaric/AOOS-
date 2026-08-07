import { beforeEach, describe, expect, it } from "vitest";

import { HasMinimumTagsSpecification } from "../../../src/classification/specifications/has-minimum-tags-specification.js";
import { resetFixtureState, makeItem } from "../../helpers/fixtures.js";

describe("HasMinimumTagsSpecification", () => {
  beforeEach(() => resetFixtureState());

  it("is satisfied when tag count meets the minimum", () => {
    const spec = new HasMinimumTagsSpecification(2);
    expect(spec.isSatisfiedBy(makeItem({ tags: ["a", "b"] }))).toBe(true);
  });

  it("is not satisfied when tag count is below the minimum", () => {
    const spec = new HasMinimumTagsSpecification(3);
    expect(spec.isSatisfiedBy(makeItem({ tags: ["a", "b"] }))).toBe(false);
  });

  it("exposes a stable name", () => {
    expect(new HasMinimumTagsSpecification(1).name).toBe("has_minimum_tags");
  });
});

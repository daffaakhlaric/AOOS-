import { beforeEach, describe, expect, it } from "vitest";

import { LowCompletenessSpecification } from "../../../src/classification/specifications/low-completeness-specification.js";
import { resetFixtureState, makeItem } from "../../helpers/fixtures.js";

describe("LowCompletenessSpecification", () => {
  beforeEach(() => resetFixtureState());

  it("is satisfied when the completeness ratio is below maxRatio", () => {
    const spec = new LowCompletenessSpecification(0.5);
    expect(spec.isSatisfiedBy(makeItem({ requiredFieldsPresent: 1, requiredFieldsTotal: 4 }))).toBe(
      true,
    );
  });

  it("is not satisfied when the completeness ratio meets or exceeds maxRatio", () => {
    const spec = new LowCompletenessSpecification(0.5);
    expect(spec.isSatisfiedBy(makeItem({ requiredFieldsPresent: 2, requiredFieldsTotal: 4 }))).toBe(
      false,
    );
  });

  it("is never satisfied when requiredFieldsTotal is 0", () => {
    const spec = new LowCompletenessSpecification(0.9);
    expect(spec.isSatisfiedBy(makeItem({ requiredFieldsPresent: 0, requiredFieldsTotal: 0 }))).toBe(
      false,
    );
  });
});

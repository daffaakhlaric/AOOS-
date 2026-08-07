import { beforeEach, describe, expect, it } from "vitest";

import { HasSummarySpecification } from "../../../src/classification/specifications/has-summary-specification.js";
import { resetFixtureState, makeItem } from "../../helpers/fixtures.js";

describe("HasSummarySpecification", () => {
  beforeEach(() => resetFixtureState());

  it("is satisfied when hasSummary is true", () => {
    expect(new HasSummarySpecification().isSatisfiedBy(makeItem({ hasSummary: true }))).toBe(true);
  });

  it("is not satisfied when hasSummary is false", () => {
    expect(new HasSummarySpecification().isSatisfiedBy(makeItem({ hasSummary: false }))).toBe(
      false,
    );
  });
});

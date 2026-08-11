import { describe, expect, it } from "vitest";

import {
  ALL_DIMENSION_NAMES,
  DimensionName,
} from "../../../../src/domain/value-objects/DimensionName.js";

describe("DimensionName", () => {
  it("ALL_DIMENSION_NAMES has exactly the 6 spec dimensions", () => {
    expect(ALL_DIMENSION_NAMES).toEqual([
      DimensionName.NATURAL_LANGUAGE,
      DimensionName.QUALIFICATION,
      DimensionName.OBJECTION_HANDLING,
      DimensionName.CLOSING_ATTEMPT,
      DimensionName.HANDOFF_QUALITY,
      DimensionName.RESPONSE_LENGTH,
    ]);
  });

  it("has no duplicate entries", () => {
    expect(new Set(ALL_DIMENSION_NAMES).size).toBe(6);
  });
});

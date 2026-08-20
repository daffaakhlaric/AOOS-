import { describe, expect, it } from "vitest";

import { PROPERTY_TYPES } from "../../../../src/domain/entities/PropertyListing.js";

describe("PropertyListing", () => {
  it("PROPERTY_TYPES has the exact 5 spec-defined types", () => {
    expect(PROPERTY_TYPES).toEqual(["RUMAH", "APARTEMEN", "RUKO", "TANAH", "VILLA"]);
  });
});

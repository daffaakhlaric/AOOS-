import { describe, expect, it } from "vitest";

import { ObjectiveStatus } from "../../../../src/domain/value-objects/ObjectiveStatus.js";

describe("ObjectiveStatus", () => {
  it("has exactly the four spec-defined lifecycle states", () => {
    expect(Object.values(ObjectiveStatus).sort()).toEqual(
      ["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"].sort(),
    );
  });
});

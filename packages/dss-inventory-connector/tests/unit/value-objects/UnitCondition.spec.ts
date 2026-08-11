import { describe, expect, it } from "vitest";

import { UnitCondition } from "../../../src/domain/value-objects/UnitCondition.js";

describe("UnitCondition", () => {
  it("has GOOD, FAIR, POOR members", () => {
    expect(UnitCondition.GOOD).toBe("GOOD");
    expect(UnitCondition.FAIR).toBe("FAIR");
    expect(UnitCondition.POOR).toBe("POOR");
  });
});

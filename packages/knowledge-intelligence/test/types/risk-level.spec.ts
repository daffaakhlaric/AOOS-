import { describe, expect, it } from "vitest";

import { RiskLevel } from "../../src/types/risk-level.js";

describe("RiskLevel", () => {
  it("defines the 4 risk bands", () => {
    expect(Object.values(RiskLevel)).toHaveLength(4);
    expect(RiskLevel.Low).toBe("low");
    expect(RiskLevel.Critical).toBe("critical");
  });
});

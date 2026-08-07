import { describe, expect, it } from "vitest";

import { HealthStatus } from "../../src/types/health-status.js";

describe("HealthStatus", () => {
  it("defines the 3 health bands", () => {
    expect(Object.values(HealthStatus)).toHaveLength(3);
    expect(HealthStatus.Healthy).toBe("healthy");
    expect(HealthStatus.AtRisk).toBe("at_risk");
    expect(HealthStatus.Critical).toBe("critical");
  });
});

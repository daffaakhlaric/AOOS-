import { describe, expect, it } from "vitest";

import { ExecutionPlanBuilder } from "../../../src/builders/ExecutionPlanBuilder.js";

describe("ExecutionPlanBuilder.build", () => {
  it("builds a valid ExecutionPlan", () => {
    const result = ExecutionPlanBuilder.build("dss-motor", [], new Date());
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.tenantId).toBe("dss-motor");
  });

  it("propagates a validation failure as DecisionError", () => {
    const result = ExecutionPlanBuilder.build("", [], new Date());
    expect(result.ok).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { ExecutionPlanId } from "../../../src/domain/value-objects/ExecutionPlanId.js";
import { ExecutionPlanFactory } from "../../../src/factories/ExecutionPlanFactory.js";

describe("ExecutionPlanFactory.create", () => {
  it("generates a fresh id when none is given", () => {
    const result = ExecutionPlanFactory.create({
      tenantId: "dss-motor",
      decisions: [],
      generatedAt: new Date(),
    });
    expect(result.ok).toBe(true);
  });

  it("uses the given id when provided", () => {
    const id = ExecutionPlanId.generate();
    const result = ExecutionPlanFactory.create({
      id,
      tenantId: "dss-motor",
      decisions: [],
      generatedAt: new Date(),
    });
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.id.equals(id)).toBe(true);
  });

  it("propagates a validation failure", () => {
    const result = ExecutionPlanFactory.create({
      tenantId: "",
      decisions: [],
      generatedAt: new Date(),
    });
    expect(result.ok).toBe(false);
  });
});

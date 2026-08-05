import { describe, expect, it } from "vitest";

import { NodeType } from "../../src/contracts/node-type.js";
import { CompatibilityValidator } from "../../src/validator/compatibility-validator.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("Node Validation Test — CompatibilityValidator", () => {
  it("passes when the Manifest type matches the Instance type", () => {
    const execution = executionFixture({ type: NodeType.CUSTOM });
    expect(new CompatibilityValidator().validate(execution).valid).toBe(true);
  });

  it("fails when the Manifest type does not match the Instance type", () => {
    const execution = executionFixture({ type: NodeType.CUSTOM });
    const mismatched = { ...execution, instance: { ...execution.instance, type: NodeType.START } };
    const result = new CompatibilityValidator().validate(mismatched);
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toBe("type");
  });
});

import { describe, expect, it } from "vitest";

import { NodeType } from "../../src/contracts/node-type.js";
import { SchemaValidator } from "../../src/validator/schema-validator.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("Node Validation Test — SchemaValidator", () => {
  it("passes when config matches the Manifest's configSchema", () => {
    const execution = executionFixture({
      type: NodeType.CAPABILITY,
      config: { capabilityId: "crm.create" },
    });
    expect(new SchemaValidator().validate(execution).valid).toBe(true);
  });

  it("fails when config does not match the Manifest's configSchema", () => {
    const execution = executionFixture({ type: NodeType.CAPABILITY, config: {} });
    const result = new SchemaValidator().validate(execution);
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toContain("config.");
  });

  it("passes trivially when the Manifest has no configSchema (Script)", () => {
    const execution = executionFixture({ type: NodeType.SCRIPT });
    expect(new SchemaValidator().validate(execution).valid).toBe(true);
  });
});

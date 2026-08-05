import { describe, expect, it } from "vitest";

import { NodeType } from "../../src/contracts/node-type.js";
import { ConfigurationValidator } from "../../src/validator/configuration-validator.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("Node Validation Test — ConfigurationValidator", () => {
  it("passes when the Node Type has a configSchema, regardless of config content", () => {
    const execution = executionFixture({
      type: NodeType.CAPABILITY,
      config: { capabilityId: "x" },
    });
    expect(new ConfigurationValidator().validate(execution).valid).toBe(true);
  });

  it("passes for a schema-less Node Type (Script) with empty config", () => {
    const execution = executionFixture({ type: NodeType.SCRIPT });
    expect(new ConfigurationValidator().validate(execution).valid).toBe(true);
  });

  it("fails for a schema-less Node Type (Script) with non-empty config", () => {
    const execution = executionFixture({ type: NodeType.SCRIPT, config: { anything: true } });
    const result = new ConfigurationValidator().validate(execution);
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toBe("config");
  });
});

import { describe, expect, it } from "vitest";

import { NodeType } from "../../src/contracts/node-type.js";
import type { INodeValidator, NodeValidationResult } from "../../src/validator/i-node-validator.js";
import { ValidationPipeline } from "../../src/validator/validation-pipeline.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("ValidationPipeline", () => {
  it("passes a fully valid Node Execution", () => {
    const result = new ValidationPipeline().run(
      executionFixture({ type: NodeType.CAPABILITY, config: { capabilityId: "crm.create" } }),
    );
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("aggregates issues from multiple stages without short-circuiting", () => {
    const execution = executionFixture({ type: NodeType.CAPABILITY, config: {} });
    const badVersion = { ...execution, manifest: { ...execution.manifest, version: "bad" } };
    const result = new ValidationPipeline().run(badVersion);
    expect(result.valid).toBe(false);
    // Schema (missing capabilityId) + Version (bad semver) at minimum.
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
  });

  it("runs supplied extraValidators in addition to the built-in stages", () => {
    const extra: INodeValidator = {
      name: "AlwaysFails",
      validate: (): NodeValidationResult => ({
        valid: false,
        issues: [{ path: "$", message: "custom failure" }],
      }),
    };
    const result = new ValidationPipeline([extra]).run(executionFixture());
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.message === "custom failure")).toBe(true);
  });
});

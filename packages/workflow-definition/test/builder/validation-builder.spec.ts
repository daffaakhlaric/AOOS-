import { describe, expect, it } from "vitest";

import { ValidationBuilder } from "../../src/builder/validation-builder.js";
import type {
  IWorkflowValidator,
  ValidationResult,
} from "../../src/validator/i-workflow-validator.js";
import { workflowFixture } from "../helpers/workflow-fixture.js";

describe("Builder API Test — ValidationBuilder", () => {
  it("validates a workflow using only the built-in pipeline stages", () => {
    const result = ValidationBuilder.create().validate(workflowFixture());
    expect(result.valid).toBe(true);
  });

  it("includes results from a withValidator()-supplied extra validator", () => {
    const extra: IWorkflowValidator = {
      name: "AlwaysFails",
      validate: (): ValidationResult => ({
        valid: false,
        issues: [{ path: "$", message: "extra failure" }],
      }),
    };
    const result = ValidationBuilder.create().withValidator(extra).validate(workflowFixture());
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.message === "extra failure")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { WorkflowIntegrationRegistry } from "../../src/registry/workflow-integration-registry.js";
import { CircularIntegrationValidator } from "../../src/validator/circular-integration-validator.js";

describe("Validator Test — CircularIntegrationValidator", () => {
  it("passes when there are no dependencies", () => {
    const result = new CircularIntegrationValidator().validate({
      registry: new WorkflowIntegrationRegistry(),
    });
    expect(result.valid).toBe(true);
  });

  it("passes for an acyclic dependency graph", () => {
    const result = new CircularIntegrationValidator().validate({
      registry: new WorkflowIntegrationRegistry(),
      dependencies: { a: ["b"], b: ["c"], c: [] },
    });
    expect(result.valid).toBe(true);
  });

  it("flags a direct two-node cycle", () => {
    const result = new CircularIntegrationValidator().validate({
      registry: new WorkflowIntegrationRegistry(),
      dependencies: { a: ["b"], b: ["a"] },
    });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain("Circular Integration");
  });

  it("flags a longer cycle", () => {
    const result = new CircularIntegrationValidator().validate({
      registry: new WorkflowIntegrationRegistry(),
      dependencies: { a: ["b"], b: ["c"], c: ["a"] },
    });
    expect(result.valid).toBe(false);
  });
});

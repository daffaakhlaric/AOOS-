import { describe, expect, it } from "vitest";

import { WorkflowIntegrationRegistry } from "../../src/registry/workflow-integration-registry.js";
import { EnvironmentValidator } from "../../src/validator/environment-validator.js";
import { contextFixture } from "../helpers/context-fixture.js";

describe("Validator Test — EnvironmentValidator", () => {
  it("passes when allowedEnvironments is not configured", () => {
    const result = new EnvironmentValidator().validate({
      registry: new WorkflowIntegrationRegistry(),
      context: contextFixture({ environment: "staging" }),
    });
    expect(result.valid).toBe(true);
  });

  it("passes when the Context's environment is in the allow-list", () => {
    const result = new EnvironmentValidator().validate({
      registry: new WorkflowIntegrationRegistry(),
      context: contextFixture({ environment: "production" }),
      allowedEnvironments: ["production"],
    });
    expect(result.valid).toBe(true);
  });

  it("flags a Context whose environment is not in the allow-list", () => {
    const result = new EnvironmentValidator().validate({
      registry: new WorkflowIntegrationRegistry(),
      context: contextFixture({ environment: "staging" }),
      allowedEnvironments: ["production"],
    });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain("staging");
  });
});

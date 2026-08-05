import { describe, expect, it } from "vitest";

import { CapabilityAdapter } from "../../src/adapter/capability-adapter.js";
import { WorkflowIntegrationRegistry } from "../../src/registry/workflow-integration-registry.js";
import { WorkflowIntegrationValidator } from "../../src/validator/workflow-integration-validator.js";
import { successfulRuntime } from "../helpers/runtime-fixture.js";

describe("Validator Test — WorkflowIntegrationValidator", () => {
  it("reports valid:true for a well-formed Registry with no extra config", () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm", successfulRuntime()));
    const result = new WorkflowIntegrationValidator().validate({ registry });
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("aggregates issues across every validator stage without short-circuiting", () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm", undefined, { version: "not-a-version" }));
    const result = new WorkflowIntegrationValidator().validate({
      registry,
      dependencies: { crm: ["ghost"] },
    });
    expect(result.valid).toBe(false);
    const paths = result.issues.map((issue) => issue.path);
    expect(paths).toContain("adapters.crm.version");
    expect(paths).toContain("adapters.crm.runtime");
    expect(paths).toContain("dependencies.crm");
  });

  it("runs an injected extra validator stage alongside the built-in 8", () => {
    const registry = new WorkflowIntegrationRegistry();
    const extraStage = {
      name: "custom",
      validate: () => ({ valid: false, issues: [{ path: "custom", message: "always fails" }] }),
    };
    const result = new WorkflowIntegrationValidator([extraStage]).validate({ registry });
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({ path: "custom", message: "always fails" });
  });
});

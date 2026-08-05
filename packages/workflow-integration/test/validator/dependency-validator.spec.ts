import { describe, expect, it } from "vitest";

import { CapabilityAdapter } from "../../src/adapter/capability-adapter.js";
import { ToolAdapter } from "../../src/adapter/tool-adapter.js";
import { WorkflowIntegrationRegistry } from "../../src/registry/workflow-integration-registry.js";
import { DependencyValidator } from "../../src/validator/dependency-validator.js";
import { successfulRuntime } from "../helpers/runtime-fixture.js";

describe("Validator Test — DependencyValidator", () => {
  it("passes when every declared dependency resolves to a registered Adapter", () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm", successfulRuntime()));
    registry.register(new ToolAdapter("calculator", successfulRuntime()));
    const result = new DependencyValidator().validate({
      registry,
      dependencies: { crm: ["calculator"] },
    });
    expect(result.valid).toBe(true);
  });

  it("flags a dependency on an unknown Adapter name", () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm", successfulRuntime()));
    const result = new DependencyValidator().validate({
      registry,
      dependencies: { crm: ["ghost-adapter"] },
    });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain("ghost-adapter");
  });

  it("passes when no dependencies are declared", () => {
    const result = new DependencyValidator().validate({
      registry: new WorkflowIntegrationRegistry(),
    });
    expect(result.valid).toBe(true);
  });
});

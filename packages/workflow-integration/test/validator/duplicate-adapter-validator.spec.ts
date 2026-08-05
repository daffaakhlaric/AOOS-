import { describe, expect, it } from "vitest";

import { CapabilityAdapter } from "../../src/adapter/capability-adapter.js";
import { ToolAdapter } from "../../src/adapter/tool-adapter.js";
import { WorkflowIntegrationRegistry } from "../../src/registry/workflow-integration-registry.js";
import { DuplicateAdapterValidator } from "../../src/validator/duplicate-adapter-validator.js";
import { successfulRuntime } from "../helpers/runtime-fixture.js";

describe("Validator Test — DuplicateAdapterValidator", () => {
  it("passes when every Adapter name is used in exactly one namespace", () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm", successfulRuntime()));
    registry.register(new ToolAdapter("calculator", successfulRuntime()));
    const result = new DuplicateAdapterValidator().validate({ registry });
    expect(result.valid).toBe(true);
  });

  it("flags an Adapter name reused across two different namespaces", () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("shared-name", successfulRuntime()));
    registry.register(new ToolAdapter("shared-name", successfulRuntime()));
    const result = new DuplicateAdapterValidator().validate({ registry });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain("shared-name");
  });

  it("passes for an empty Registry", () => {
    const result = new DuplicateAdapterValidator().validate({
      registry: new WorkflowIntegrationRegistry(),
    });
    expect(result.valid).toBe(true);
  });
});

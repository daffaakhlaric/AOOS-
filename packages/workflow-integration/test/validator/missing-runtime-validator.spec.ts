import { describe, expect, it } from "vitest";

import { CapabilityAdapter } from "../../src/adapter/capability-adapter.js";
import { WorkflowIntegrationRegistry } from "../../src/registry/workflow-integration-registry.js";
import { MissingRuntimeValidator } from "../../src/validator/missing-runtime-validator.js";
import { successfulRuntime } from "../helpers/runtime-fixture.js";

describe("Validator Test — MissingRuntimeValidator", () => {
  it("passes when every registered Adapter has a configured runtime", () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm", successfulRuntime()));
    const result = new MissingRuntimeValidator().validate({ registry });
    expect(result.valid).toBe(true);
  });

  it("flags an Adapter with no configured runtime", () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm"));
    const result = new MissingRuntimeValidator().validate({ registry });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain("crm");
  });
});

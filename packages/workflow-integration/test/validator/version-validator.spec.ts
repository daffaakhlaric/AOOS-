import { describe, expect, it } from "vitest";

import { CapabilityAdapter } from "../../src/adapter/capability-adapter.js";
import { WorkflowIntegrationRegistry } from "../../src/registry/workflow-integration-registry.js";
import { VersionValidator } from "../../src/validator/version-validator.js";
import { successfulRuntime } from "../helpers/runtime-fixture.js";

describe("Validator Test — VersionValidator", () => {
  it("passes for a valid MAJOR.MINOR.PATCH version", () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm", successfulRuntime(), { version: "1.2.3" }));
    const result = new VersionValidator().validate({ registry });
    expect(result.valid).toBe(true);
  });

  it("flags an invalid version string", () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(
      new CapabilityAdapter("crm", successfulRuntime(), { version: "not-a-version" }),
    );
    const result = new VersionValidator().validate({ registry });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain("not-a-version");
  });
});

import { describe, expect, it } from "vitest";

import { CapabilityAdapter } from "../../src/adapter/capability-adapter.js";
import type { IntegrationNamespace } from "../../src/contracts/integration-namespace.js";
import { WorkflowIntegrationRegistry } from "../../src/registry/workflow-integration-registry.js";
import { NamespaceValidator } from "../../src/validator/namespace-validator.js";
import { successfulRuntime } from "../helpers/runtime-fixture.js";

describe("Validator Test — NamespaceValidator", () => {
  it("passes for a normally-registered Adapter", () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm", successfulRuntime()));
    const result = new NamespaceValidator().validate({ registry });
    expect(result.valid).toBe(true);
  });

  it("flags an Adapter with an unknown namespace value", () => {
    const registry = new WorkflowIntegrationRegistry();
    const adapter = new CapabilityAdapter("crm", successfulRuntime());
    Object.defineProperty(adapter, "namespace", {
      value: "not-a-real-namespace" as IntegrationNamespace,
      writable: true,
    });
    registry.register(adapter);
    const result = new NamespaceValidator().validate({ registry });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain("not-a-real-namespace");
  });
});

import { describe, expect, it } from "vitest";

import { CapabilityAdapter } from "../../src/adapter/capability-adapter.js";
import { ToolAdapter } from "../../src/adapter/tool-adapter.js";
import { IntegrationNamespace } from "../../src/contracts/integration-namespace.js";
import { AdapterAlreadyRegisteredException } from "../../src/errors/adapter-already-registered-exception.js";
import { AdapterNotFoundException } from "../../src/errors/adapter-not-found-exception.js";
import { WorkflowIntegrationRegistry } from "../../src/registry/workflow-integration-registry.js";
import { failingRuntime, successfulRuntime } from "../helpers/runtime-fixture.js";

describe("Registry Test — WorkflowIntegrationRegistry", () => {
  it("register() then resolve() returns the registered Adapter", () => {
    const registry = new WorkflowIntegrationRegistry();
    const adapter = new CapabilityAdapter("crm", successfulRuntime());
    registry.register(adapter);
    expect(registry.resolve(IntegrationNamespace.CAPABILITY)).toBe(adapter);
  });

  it("register() throws AdapterAlreadyRegisteredException for a duplicate namespace+name+version", () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm", successfulRuntime()));
    expect(() => registry.register(new CapabilityAdapter("crm", successfulRuntime()))).toThrow(
      AdapterAlreadyRegisteredException,
    );
  });

  it("allows the same name across two different versions", () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm", successfulRuntime(), { version: "1.0.0" }));
    registry.register(new CapabilityAdapter("crm", successfulRuntime(), { version: "2.0.0" }));
    expect(registry.list(IntegrationNamespace.CAPABILITY)).toHaveLength(2);
  });

  it("resolve() returns the highest-priority Adapter when multiple are registered", () => {
    const registry = new WorkflowIntegrationRegistry();
    const low = new CapabilityAdapter("low", successfulRuntime(), { priority: 1 });
    const high = new CapabilityAdapter("high", successfulRuntime(), { priority: 10 });
    registry.register(low);
    registry.register(high);
    expect(registry.resolve(IntegrationNamespace.CAPABILITY)).toBe(high);
  });

  it("resolve() throws AdapterNotFoundException when nothing is registered for the namespace", () => {
    const registry = new WorkflowIntegrationRegistry();
    expect(() => registry.resolve(IntegrationNamespace.CAPABILITY)).toThrow(
      AdapterNotFoundException,
    );
  });

  it("resolve() supports narrowing by name/version", () => {
    const registry = new WorkflowIntegrationRegistry();
    const v1 = new CapabilityAdapter("crm", successfulRuntime(), { version: "1.0.0" });
    const v2 = new CapabilityAdapter("crm", successfulRuntime(), { version: "2.0.0" });
    registry.register(v1);
    registry.register(v2);
    expect(registry.resolve(IntegrationNamespace.CAPABILITY, { version: "1.0.0" })).toBe(v1);
  });

  it("resolve() supports narrowing by name and includes the name in the not-found message", () => {
    const registry = new WorkflowIntegrationRegistry();
    const crm = new CapabilityAdapter("crm", successfulRuntime());
    registry.register(crm);
    registry.register(new CapabilityAdapter("other", successfulRuntime()));
    expect(registry.resolve(IntegrationNamespace.CAPABILITY, { name: "crm" })).toBe(crm);
    expect(() => registry.resolve(IntegrationNamespace.CAPABILITY, { name: "ghost" })).toThrow(
      'matching name "ghost"',
    );
  });

  it("resolve() supports requireAvailable filtering out unavailable Adapters", () => {
    const registry = new WorkflowIntegrationRegistry();
    const unavailable = new CapabilityAdapter("no-runtime", undefined, { priority: 10 });
    const available = new CapabilityAdapter("with-runtime", successfulRuntime(), { priority: 1 });
    registry.register(unavailable);
    registry.register(available);
    expect(registry.resolve(IntegrationNamespace.CAPABILITY, { requireAvailable: true })).toBe(
      available,
    );
  });

  it("replace() swaps out an existing registration with the same namespace+name+version", () => {
    const registry = new WorkflowIntegrationRegistry();
    const original = new CapabilityAdapter("crm", failingRuntime());
    registry.register(original);
    const replacement = new CapabilityAdapter("crm", successfulRuntime());
    registry.replace(replacement);
    expect(registry.resolve(IntegrationNamespace.CAPABILITY)).toBe(replacement);
    expect(registry.list(IntegrationNamespace.CAPABILITY)).toHaveLength(1);
  });

  it("replace() also works when nothing was previously registered", () => {
    const registry = new WorkflowIntegrationRegistry();
    const adapter = new CapabilityAdapter("crm", successfulRuntime());
    registry.replace(adapter);
    expect(registry.resolve(IntegrationNamespace.CAPABILITY)).toBe(adapter);
  });

  it("remove() deletes a specific version and returns true", () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm", successfulRuntime(), { version: "1.0.0" }));
    expect(registry.remove(IntegrationNamespace.CAPABILITY, "crm", "1.0.0")).toBe(true);
    expect(registry.list(IntegrationNamespace.CAPABILITY)).toHaveLength(0);
  });

  it("remove() with no version removes every version of that name", () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm", successfulRuntime(), { version: "1.0.0" }));
    registry.register(new CapabilityAdapter("crm", successfulRuntime(), { version: "2.0.0" }));
    expect(registry.remove(IntegrationNamespace.CAPABILITY, "crm")).toBe(true);
    expect(registry.list(IntegrationNamespace.CAPABILITY)).toHaveLength(0);
  });

  it("remove() returns false when nothing matches", () => {
    const registry = new WorkflowIntegrationRegistry();
    expect(registry.remove(IntegrationNamespace.CAPABILITY, "does-not-exist")).toBe(false);
  });

  it("list() with no namespace returns every registered Adapter across all namespaces", () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm", successfulRuntime()));
    registry.register(new ToolAdapter("calculator", successfulRuntime()));
    expect(registry.list()).toHaveLength(2);
  });

  it("list() returns an empty array for a namespace with nothing registered", () => {
    const registry = new WorkflowIntegrationRegistry();
    expect(registry.list(IntegrationNamespace.CAPABILITY)).toEqual([]);
  });

  it("registrations() returns an empty array for a namespace with nothing registered", () => {
    const registry = new WorkflowIntegrationRegistry();
    expect(registry.registrations(IntegrationNamespace.CAPABILITY)).toEqual([]);
  });

  it("listNamespaces() reports only namespaces with at least one registration", () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm", successfulRuntime()));
    expect(registry.listNamespaces()).toEqual([IntegrationNamespace.CAPABILITY]);
  });

  it("registrations() exposes registeredAt bookkeeping", () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm", successfulRuntime()));
    const registrations = registry.registrations(IntegrationNamespace.CAPABILITY);
    expect(registrations).toHaveLength(1);
    expect(registrations[0]?.registeredAt).toEqual(expect.any(String));
  });
});

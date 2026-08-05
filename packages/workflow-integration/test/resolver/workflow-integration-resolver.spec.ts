import { describe, expect, it } from "vitest";

import { CapabilityAdapter } from "../../src/adapter/capability-adapter.js";
import { ToolAdapter } from "../../src/adapter/tool-adapter.js";
import { IntegrationNamespace } from "../../src/contracts/integration-namespace.js";
import { AdapterNotFoundException } from "../../src/errors/adapter-not-found-exception.js";
import { WorkflowIntegrationRegistry } from "../../src/registry/workflow-integration-registry.js";
import { WorkflowIntegrationResolver } from "../../src/resolver/workflow-integration-resolver.js";
import { successfulRuntime } from "../helpers/runtime-fixture.js";

describe("Resolver Test — WorkflowIntegrationResolver", () => {
  it("resolve() delegates straight to the Registry", () => {
    const registry = new WorkflowIntegrationRegistry();
    const adapter = new CapabilityAdapter("crm", successfulRuntime());
    registry.register(adapter);
    const resolver = new WorkflowIntegrationResolver(registry);
    expect(resolver.resolve(IntegrationNamespace.CAPABILITY)).toBe(adapter);
  });

  it("resolveCapability()/resolveTool() resolve their matching namespace", () => {
    const registry = new WorkflowIntegrationRegistry();
    const capability = new CapabilityAdapter("crm", successfulRuntime());
    const tool = new ToolAdapter("calculator", successfulRuntime());
    registry.register(capability);
    registry.register(tool);
    const resolver = new WorkflowIntegrationResolver(registry);
    expect(resolver.resolveCapability()).toBe(capability);
    expect(resolver.resolveTool()).toBe(tool);
  });

  it("resolveConnector()/resolveKnowledge()/resolveMemory()/resolvePrompt()/resolveModel()/resolveAgent()/resolveExperience() throw AdapterNotFoundException with nothing registered", () => {
    const resolver = new WorkflowIntegrationResolver(new WorkflowIntegrationRegistry());
    expect(() => resolver.resolveConnector()).toThrow(AdapterNotFoundException);
    expect(() => resolver.resolveKnowledge()).toThrow(AdapterNotFoundException);
    expect(() => resolver.resolveMemory()).toThrow(AdapterNotFoundException);
    expect(() => resolver.resolvePrompt()).toThrow(AdapterNotFoundException);
    expect(() => resolver.resolveModel()).toThrow(AdapterNotFoundException);
    expect(() => resolver.resolveAgent()).toThrow(AdapterNotFoundException);
    expect(() => resolver.resolveExperience()).toThrow(AdapterNotFoundException);
  });

  it("resolveChain() resolves every registered namespace and silently skips the rest", () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm", successfulRuntime()));
    registry.register(new ToolAdapter("calculator", successfulRuntime()));
    const resolver = new WorkflowIntegrationResolver(registry);

    const chain = resolver.resolveChain();

    expect(chain.size).toBe(2);
    expect(chain.get(IntegrationNamespace.CAPABILITY)?.name).toBe("crm");
    expect(chain.get(IntegrationNamespace.TOOL)?.name).toBe("calculator");
    expect(chain.has(IntegrationNamespace.CONNECTOR)).toBe(false);
  });

  it("resolveChain() resolves namespaces in INTEGRATION_RESOLUTION_ORDER", () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new ToolAdapter("calculator", successfulRuntime()));
    registry.register(new CapabilityAdapter("crm", successfulRuntime()));
    const resolver = new WorkflowIntegrationResolver(registry);

    const chain = resolver.resolveChain();

    expect(Array.from(chain.keys())).toEqual([
      IntegrationNamespace.CAPABILITY,
      IntegrationNamespace.TOOL,
    ]);
  });

  it("resolveChain() returns an empty Map when nothing is registered", () => {
    const resolver = new WorkflowIntegrationResolver(new WorkflowIntegrationRegistry());
    expect(resolver.resolveChain().size).toBe(0);
  });

  it("resolveChain() rethrows a non-AdapterNotFoundException error from the Registry", () => {
    const brokenRegistry = {
      resolve: () => {
        throw new Error("registry exploded");
      },
    } as unknown as WorkflowIntegrationRegistry;
    const resolver = new WorkflowIntegrationResolver(brokenRegistry);
    expect(() => resolver.resolveChain()).toThrow("registry exploded");
  });
});

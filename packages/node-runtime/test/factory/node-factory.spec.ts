import { describe, expect, it } from "vitest";

import { NodeType } from "../../src/contracts/node-type.js";
import { NodeFactoryException } from "../../src/errors/node-factory-exception.js";
import { NodeFactory } from "../../src/factory/node-factory.js";
import { NodeRegistry } from "../../src/registry/node-registry.js";
import { NodeResolver } from "../../src/resolver/node-resolver.js";
import { definitionFixture } from "../helpers/definition-fixture.js";

describe("Factory Test — NodeFactory", () => {
  const registry = new NodeRegistry();
  const resolver = new NodeResolver(registry);
  const factory = new NodeFactory(registry, resolver);

  it("createFromDefinition() maps the Workflow Definition's Node Type and derives dependsOn from incoming Transitions", () => {
    const definition = definitionFixture();
    const instance = factory.createFromDefinition({
      workflowInstanceId: "wf-inst-1",
      definition,
      nodeId: "cap-1",
    });
    expect(instance.type).toBe(NodeType.CAPABILITY);
    expect(instance.nodeId).toBe("cap-1");
    expect(instance.dependsOn).toEqual(["start"]);
    expect(instance.metadata).toMatchObject({
      source: "workflow-definition",
      name: "Do capability",
    });
  });

  it("createFromDefinition() leaves dependsOn undefined for a Node with no incoming Transitions (Start)", () => {
    const definition = definitionFixture();
    const instance = factory.createFromDefinition({
      workflowInstanceId: "wf-inst-1",
      definition,
      nodeId: "start",
    });
    expect(instance.dependsOn).toBeUndefined();
  });

  it("createFromDefinition() throws NodeFactoryException when the mapped Node Type is not registered", () => {
    const emptyFactory = new NodeFactory(
      new NodeRegistry([]),
      new NodeResolver(new NodeRegistry([])),
    );
    const definition = definitionFixture();
    expect(() =>
      emptyFactory.createFromDefinition({
        workflowInstanceId: "wf-inst-1",
        definition,
        nodeId: "start",
      }),
    ).toThrow(NodeFactoryException);
  });

  it("createFromRegistry() builds a Node Instance directly from a registered Node Type", () => {
    const instance = factory.createFromRegistry({
      workflowInstanceId: "wf-inst-1",
      nodeId: "n-1",
      type: NodeType.CAPABILITY,
      config: { capabilityId: "crm.create" },
    });
    expect(instance.type).toBe(NodeType.CAPABILITY);
    expect(instance.config).toEqual({ capabilityId: "crm.create" });
  });

  it("createFromRegistry() throws NodeFactoryException for an unregistered Node Type", () => {
    const emptyFactory = new NodeFactory(new NodeRegistry([]), resolver);
    expect(() =>
      emptyFactory.createFromRegistry({
        workflowInstanceId: "wf-inst-1",
        nodeId: "n-1",
        type: NodeType.CAPABILITY,
      }),
    ).toThrow(NodeFactoryException);
  });

  it("createFromBlueprint() builds a Node Instance from a NodeBlueprint, carrying dependsOn through", () => {
    const instance = factory.createFromBlueprint({
      workflowInstanceId: "wf-inst-1",
      blueprint: { nodeId: "n-1", type: NodeType.CUSTOM, dependsOn: ["n-0"] },
    });
    expect(instance.type).toBe(NodeType.CUSTOM);
    expect(instance.dependsOn).toEqual(["n-0"]);
  });

  it("createFromBlueprint() throws NodeFactoryException for an unregistered Node Type", () => {
    const emptyFactory = new NodeFactory(new NodeRegistry([]), resolver);
    expect(() =>
      emptyFactory.createFromBlueprint({
        workflowInstanceId: "wf-inst-1",
        blueprint: { nodeId: "n-1", type: NodeType.CUSTOM },
      }),
    ).toThrow(NodeFactoryException);
  });
});

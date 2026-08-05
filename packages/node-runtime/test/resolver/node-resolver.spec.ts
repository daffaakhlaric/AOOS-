import { describe, expect, it } from "vitest";

import { NodeType } from "../../src/contracts/node-type.js";
import { NodeNotFoundException } from "../../src/errors/node-not-found-exception.js";
import { NodeRegistry } from "../../src/registry/node-registry.js";
import { NodeResolver } from "../../src/resolver/node-resolver.js";
import { definitionFixture } from "../helpers/definition-fixture.js";

describe("Resolver Test — NodeResolver", () => {
  const resolver = new NodeResolver(new NodeRegistry());

  it("resolveType() returns the registered Manifest", () => {
    expect(resolver.resolveType(NodeType.CAPABILITY).type).toBe(NodeType.CAPABILITY);
  });

  it("resolveType() throws NodeNotFoundException for an unregistered type", () => {
    const emptyResolver = new NodeResolver(new NodeRegistry([]));
    expect(() => emptyResolver.resolveType(NodeType.START)).toThrow(NodeNotFoundException);
  });

  it("resolveVersion() returns the Manifest's version", () => {
    expect(resolver.resolveVersion(NodeType.START)).toBe("1.0.0");
  });

  it("resolveDefinitionNode() finds a Node by id in a WorkflowDefinition", () => {
    const definition = definitionFixture();
    expect(resolver.resolveDefinitionNode(definition, "cap-1").id).toBe("cap-1");
  });

  it("resolveDefinitionNode() throws NodeNotFoundException for an unknown id", () => {
    const definition = definitionFixture();
    expect(() => resolver.resolveDefinitionNode(definition, "ghost")).toThrow(
      NodeNotFoundException,
    );
  });
});

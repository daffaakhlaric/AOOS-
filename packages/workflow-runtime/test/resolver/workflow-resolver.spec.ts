import { NodeType } from "@aos/workflow-definition";
import { describe, expect, it } from "vitest";

import { NodeNotFoundException } from "../../src/errors/node-not-found-exception.js";
import { WorkflowResolver } from "../../src/resolver/workflow-resolver.js";
import { definitionFixture } from "../helpers/definition-fixture.js";

describe("Resolver Test — WorkflowResolver", () => {
  const resolver = new WorkflowResolver();

  it("resolveStartNode() finds the Start node", () => {
    const node = resolver.resolveStartNode(definitionFixture());
    expect(node.type).toBe(NodeType.START);
    expect(node.id).toBe("start");
  });

  it("resolveStartNode() throws NodeNotFoundException when no Start node exists", () => {
    const definition = {
      ...definitionFixture(),
      nodes: definitionFixture().nodes.filter((n) => n.type !== NodeType.START),
    };
    expect(() => resolver.resolveStartNode(definition)).toThrow(NodeNotFoundException);
  });

  it("resolveEndNodes() finds every End node", () => {
    const nodes = resolver.resolveEndNodes(definitionFixture());
    expect(nodes.map((n) => n.id)).toEqual(["end"]);
  });

  it("resolveNode() finds a Node by id and throws for an unknown id", () => {
    const definition = definitionFixture();
    expect(resolver.resolveNode(definition, "task-1").id).toBe("task-1");
    expect(() => resolver.resolveNode(definition, "ghost")).toThrow(NodeNotFoundException);
  });

  it("resolveOutgoingTransitions() finds every Transition leaving a Node", () => {
    const definition = definitionFixture();
    expect(resolver.resolveOutgoingTransitions(definition, "start").map((t) => t.id)).toEqual([
      "t-1",
    ]);
    expect(resolver.resolveOutgoingTransitions(definition, "end")).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";

import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { KnowledgeNodeType } from "../../src/domain/knowledge-node-type.js";
import { EdgeNotFoundException } from "../../src/errors/edge-not-found-exception.js";
import { NodeNotFoundException } from "../../src/errors/node-not-found-exception.js";
import { GraphEngine } from "../../src/graph/graph-engine.js";
import { addEdge, addNode, buildDagEngine } from "../helpers/graph-fixtures.js";

function node(id: string) {
  return {
    id,
    type: KnowledgeNodeType.Knowledge,
    label: id,
    metadata: {},
    createdAt: 0,
    updatedAt: 0,
  };
}

function edge(id: string, sourceNodeId: string, targetNodeId: string) {
  return {
    id,
    type: KnowledgeEdgeType.RelatedTo,
    sourceNodeId,
    targetNodeId,
    weight: 1,
    metadata: {},
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("GraphEngine.create", () => {
  it("creates an empty graph with defaulted id/timestamps/version", () => {
    const engine = GraphEngine.create({ name: "My Graph" });
    expect(engine.graph.name).toBe("My Graph");
    expect(engine.graph.id).toBeTruthy();
    expect(engine.graph.version).toBe(0);
    expect(engine.listNodes()).toHaveLength(0);
    expect(engine.listEdges()).toHaveLength(0);
  });

  it("honors a caller-supplied id and description", () => {
    const engine = GraphEngine.create({ id: "g1", name: "My Graph", description: "desc" });
    expect(engine.graph.id).toBe("g1");
    expect(engine.graph.description).toBe("desc");
  });
});

describe("GraphEngine node CRUD", () => {
  it("addNode stores the node and touches updatedAt", () => {
    const engine = GraphEngine.create({ name: "g" });
    const before = engine.graph.updatedAt;
    engine.addNode(node("n1"));
    expect(engine.hasNode("n1")).toBe(true);
    expect(engine.getNode("n1").id).toBe("n1");
    expect(engine.graph.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it("getNode throws NodeNotFoundException for a missing node", () => {
    const engine = GraphEngine.create({ name: "g" });
    expect(() => engine.getNode("missing")).toThrow(NodeNotFoundException);
  });

  it("tryGetNode returns undefined for a missing node", () => {
    const engine = GraphEngine.create({ name: "g" });
    expect(engine.tryGetNode("missing")).toBeUndefined();
  });

  it("replaceNode overwrites an existing node", () => {
    const engine = GraphEngine.create({ name: "g" });
    engine.addNode(node("n1"));
    const replacement = { ...node("n1"), label: "renamed" };
    engine.replaceNode(replacement);
    expect(engine.getNode("n1").label).toBe("renamed");
  });

  it("replaceNode throws NodeNotFoundException when the node does not exist", () => {
    const engine = GraphEngine.create({ name: "g" });
    expect(() => engine.replaceNode(node("missing"))).toThrow(NodeNotFoundException);
  });

  it("listNodes returns every node", () => {
    const engine = GraphEngine.create({ name: "g" });
    engine.addNode(node("n1"));
    engine.addNode(node("n2"));
    expect(
      engine
        .listNodes()
        .map((n) => n.id)
        .sort(),
    ).toEqual(["n1", "n2"]);
  });

  it("removeNode removes the node and cascades incident edges", () => {
    const engine = GraphEngine.create({ name: "g" });
    engine.addNode(node("n1"));
    engine.addNode(node("n2"));
    engine.addNode(node("n3"));
    engine.addEdge(edge("e1", "n1", "n2"));
    engine.addEdge(edge("e2", "n3", "n1"));
    const removedEdgeIds = engine.removeNode("n1");
    expect(removedEdgeIds.sort()).toEqual(["e1", "e2"]);
    expect(engine.hasNode("n1")).toBe(false);
    expect(engine.hasEdge("e1")).toBe(false);
    expect(engine.hasEdge("e2")).toBe(false);
  });

  it("removeNode throws NodeNotFoundException for a missing node", () => {
    const engine = GraphEngine.create({ name: "g" });
    expect(() => engine.removeNode("missing")).toThrow(NodeNotFoundException);
  });
});

describe("GraphEngine edge CRUD", () => {
  it("addEdge requires the source node to exist", () => {
    const engine = GraphEngine.create({ name: "g" });
    engine.addNode(node("n2"));
    expect(() => engine.addEdge(edge("e1", "missing", "n2"))).toThrow(NodeNotFoundException);
  });

  it("addEdge requires the target node to exist", () => {
    const engine = GraphEngine.create({ name: "g" });
    engine.addNode(node("n1"));
    expect(() => engine.addEdge(edge("e1", "n1", "missing"))).toThrow(NodeNotFoundException);
  });

  it("addEdge indexes the edge for outgoing/incoming lookup", () => {
    const engine = GraphEngine.create({ name: "g" });
    engine.addNode(node("n1"));
    engine.addNode(node("n2"));
    engine.addEdge(edge("e1", "n1", "n2"));
    expect(engine.outgoingEdges("n1").map((e) => e.id)).toEqual(["e1"]);
    expect(engine.incomingEdges("n2").map((e) => e.id)).toEqual(["e1"]);
    expect(engine.outgoingNeighborIds("n1")).toEqual(["n2"]);
    expect(engine.incomingNeighborIds("n2")).toEqual(["n1"]);
  });

  it("getEdge throws EdgeNotFoundException for a missing edge", () => {
    const engine = GraphEngine.create({ name: "g" });
    expect(() => engine.getEdge("missing")).toThrow(EdgeNotFoundException);
  });

  it("tryGetEdge returns undefined for a missing edge", () => {
    const engine = GraphEngine.create({ name: "g" });
    expect(engine.tryGetEdge("missing")).toBeUndefined();
  });

  it("replaceEdge overwrites an existing edge", () => {
    const engine = GraphEngine.create({ name: "g" });
    engine.addNode(node("n1"));
    engine.addNode(node("n2"));
    engine.addEdge(edge("e1", "n1", "n2"));
    const replacement = { ...edge("e1", "n1", "n2"), weight: 5 };
    engine.replaceEdge(replacement);
    expect(engine.getEdge("e1").weight).toBe(5);
  });

  it("replaceEdge throws EdgeNotFoundException when the edge does not exist", () => {
    const engine = GraphEngine.create({ name: "g" });
    expect(() => engine.replaceEdge(edge("missing", "n1", "n2"))).toThrow(EdgeNotFoundException);
  });

  it("listEdges returns every edge", () => {
    const engine = GraphEngine.create({ name: "g" });
    engine.addNode(node("n1"));
    engine.addNode(node("n2"));
    engine.addEdge(edge("e1", "n1", "n2"));
    expect(engine.listEdges().map((e) => e.id)).toEqual(["e1"]);
  });

  it("removeEdge un-indexes and removes the edge", () => {
    const engine = GraphEngine.create({ name: "g" });
    engine.addNode(node("n1"));
    engine.addNode(node("n2"));
    engine.addEdge(edge("e1", "n1", "n2"));
    engine.removeEdge("e1");
    expect(engine.hasEdge("e1")).toBe(false);
    expect(engine.outgoingEdges("n1")).toHaveLength(0);
    expect(engine.incomingEdges("n2")).toHaveLength(0);
  });

  it("removeEdge throws EdgeNotFoundException for a missing edge", () => {
    const engine = GraphEngine.create({ name: "g" });
    expect(() => engine.removeEdge("missing")).toThrow(EdgeNotFoundException);
  });

  it("outgoing/incomingNeighborIds filter by edge type when provided", () => {
    const engine = GraphEngine.create({ name: "g" });
    addNode(engine, "n1");
    addNode(engine, "n2");
    addNode(engine, "n3");
    addEdge(engine, "n1", "n2", KnowledgeEdgeType.DependsOn);
    addEdge(engine, "n1", "n3", KnowledgeEdgeType.RelatedTo);
    expect(engine.outgoingNeighborIds("n1", new Set([KnowledgeEdgeType.DependsOn]))).toEqual([
      "n2",
    ]);
    expect(engine.incomingNeighborIds("n2", new Set([KnowledgeEdgeType.DependsOn]))).toEqual([
      "n1",
    ]);
    expect(engine.incomingNeighborIds("n3", new Set([KnowledgeEdgeType.DependsOn]))).toEqual([]);
  });

  it("outgoing/incomingEdges default to an empty array for a node with none", () => {
    const engine = GraphEngine.create({ name: "g" });
    engine.addNode(node("n1"));
    expect(engine.outgoingEdges("n1")).toEqual([]);
    expect(engine.incomingEdges("n1")).toEqual([]);
  });
});

describe("GraphEngine.clone", () => {
  it("produces a deep, independent copy with a new id/timestamps/version", () => {
    const engine = buildDagEngine();
    const clone = engine.clone();
    expect(clone.graph.id).not.toBe(engine.graph.id);
    expect(clone.graph.version).toBe(0);
    expect(
      clone
        .listNodes()
        .map((n) => n.id)
        .sort(),
    ).toEqual(
      engine
        .listNodes()
        .map((n) => n.id)
        .sort(),
    );
    clone.removeNode("A");
    expect(engine.hasNode("A")).toBe(true);
  });

  it("honors a caller-supplied new id", () => {
    const engine = buildDagEngine();
    const clone = engine.clone("clone-1");
    expect(clone.graph.id).toBe("clone-1");
  });
});

describe("GraphEngine.wrap", () => {
  it("wraps an existing aggregate and re-derives adjacency indexes", () => {
    const engine = buildDagEngine();
    const wrapped = GraphEngine.wrap(engine.graph);
    expect(wrapped.outgoingNeighborIds("A").sort()).toEqual(["B", "C"]);
  });

  it("a wrapped node with no incident edges was never adjacency-indexed by the constructor", () => {
    // GraphEngine's constructor only initializes adjacency Sets while indexing edges — a node with
    // zero edges (e.g. restored from a snapshot) never gets an entry, exercising the `?? []`/
    // `?? new Set()` fallbacks in removeNode/outgoingEdges/incomingEdges.
    const engine = buildDagEngine();
    engine.graph.nodes.set("isolated", {
      id: "isolated",
      type: engine.getNode("A").type,
      label: "isolated",
      metadata: {},
      createdAt: 0,
      updatedAt: 0,
    });
    const wrapped = GraphEngine.wrap(engine.graph);
    expect(wrapped.outgoingEdges("isolated")).toEqual([]);
    expect(wrapped.incomingEdges("isolated")).toEqual([]);
    expect(wrapped.removeNode("isolated")).toEqual([]);
    expect(wrapped.hasNode("isolated")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { KnowledgeNodeType } from "../../src/domain/knowledge-node-type.js";
import { CycleDetectedException } from "../../src/errors/cycle-detected-exception.js";
import { EdgeNotFoundException } from "../../src/errors/edge-not-found-exception.js";
import { GraphAuthorizationException } from "../../src/errors/graph-authorization-exception.js";
import { GraphConfigurationException } from "../../src/errors/graph-configuration-exception.js";
import { GraphNotFoundException } from "../../src/errors/graph-not-found-exception.js";
import { NodeNotFoundException } from "../../src/errors/node-not-found-exception.js";
import { RelationshipValidationException } from "../../src/errors/relationship-validation-exception.js";
import type { InMemoryEventPublisher } from "../../src/events/in-memory-event-publisher.js";
import { KnowledgeGraphManager } from "../../src/manager/knowledge-graph-manager.js";
import { buildTestContext } from "../helpers/context-fixture.js";

function setup(configuration = {}) {
  const ctx = buildTestContext(configuration);
  const manager = new KnowledgeGraphManager(ctx);
  return { ctx, manager };
}

describe("KnowledgeGraphManager — graph lifecycle", () => {
  it("createGraph registers a new graph and bumps graphCount metric", () => {
    const { ctx, manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    expect(graph.name).toBe("G1");
    expect(ctx.graphRegistry.has(graph.id)).toBe(true);
    expect(ctx.metricsCollector.snapshot().graphCount).toBe(1);
  });

  it("createGraph publishes GraphCreated", () => {
    const { ctx, manager } = setup();
    manager.createGraph({ name: "G1" });
    expect((ctx.eventPublisher as InMemoryEventPublisher).getHistory()).toHaveLength(1);
  });

  it("createGraph rejects an empty name", () => {
    const { manager } = setup();
    expect(() => manager.createGraph({ name: "" })).toThrow(GraphConfigurationException);
  });

  it("createGraph honors a caller-supplied id", () => {
    const { manager } = setup();
    const graph = manager.createGraph({ id: "g1", name: "G1" });
    expect(graph.id).toBe("g1");
  });

  it("deleteGraph removes the graph and cascades node/edge registry entries", () => {
    const { ctx, manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    const node1 = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n1" });
    const node2 = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n2" });
    const edge = manager.createEdge(graph.id, {
      type: KnowledgeEdgeType.RelatedTo,
      sourceNodeId: node1.id,
      targetNodeId: node2.id,
    });
    manager.deleteGraph(graph.id);
    expect(ctx.graphRegistry.has(graph.id)).toBe(false);
    expect(ctx.nodeRegistry.has(node1.id)).toBe(false);
    expect(ctx.edgeRegistry.has(edge.id)).toBe(false);
    expect(ctx.relationshipRegistry.has(edge.id)).toBe(false);
  });

  it("deleteGraph throws GraphNotFoundException for an unknown graph", () => {
    const { manager } = setup();
    expect(() => manager.deleteGraph("missing")).toThrow(GraphNotFoundException);
  });

  it("cloneGraph produces an independent copy (nodes AND edges) registered under a new id", () => {
    const { ctx, manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    const n1 = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n1" });
    const n2 = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n2" });
    manager.createEdge(graph.id, {
      type: KnowledgeEdgeType.RelatedTo,
      sourceNodeId: n1.id,
      targetNodeId: n2.id,
    });
    const cloned = manager.cloneGraph(graph.id);
    expect(cloned.id).not.toBe(graph.id);
    expect(ctx.graphRegistry.get(cloned.id).listNodes()).toHaveLength(2);
    expect(ctx.graphRegistry.get(cloned.id).listEdges()).toHaveLength(1);
    expect(ctx.edgeRegistry.get(ctx.graphRegistry.get(cloned.id).listEdges()[0]!.id).graphId).toBe(
      cloned.id,
    );
  });

  it("cloneGraph honors a caller-supplied new id", () => {
    const { manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    const cloned = manager.cloneGraph(graph.id, "clone-1");
    expect(cloned.id).toBe("clone-1");
  });

  it("snapshotGraph captures current nodes/edges and registers the snapshot", () => {
    const { ctx, manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n1" });
    const snapshot = manager.snapshotGraph(graph.id, "checkpoint");
    expect(snapshot.label).toBe("checkpoint");
    expect(snapshot.nodes).toHaveLength(1);
    expect(ctx.snapshotRegistry.has(snapshot.id)).toBe(true);
  });

  it("restoreGraph restores a graph's nodes/edges from a snapshot, in place", () => {
    const { ctx, manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    const node1 = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n1" });
    const snapshot = manager.snapshotGraph(graph.id);
    const node2 = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n2" });
    const edge = manager.createEdge(graph.id, {
      type: KnowledgeEdgeType.RelatedTo,
      sourceNodeId: node1.id,
      targetNodeId: node2.id,
    });
    expect(ctx.graphRegistry.get(graph.id).listNodes()).toHaveLength(2);
    expect(ctx.graphRegistry.get(graph.id).listEdges()).toHaveLength(1);

    const restored = manager.restoreGraph(snapshot.id);
    expect(restored.id).toBe(graph.id);
    const restoredEngine = ctx.graphRegistry.get(graph.id);
    expect(restoredEngine.listNodes().map((n) => n.id)).toEqual([node1.id]);
    expect(restoredEngine.listEdges()).toHaveLength(0);
    expect(ctx.nodeRegistry.has(node2.id)).toBe(false);
    expect(ctx.edgeRegistry.has(edge.id)).toBe(false);
    expect(ctx.relationshipRegistry.has(edge.id)).toBe(false);
  });

  it("mergeGraph unions source into target and reports the merge result", () => {
    const { manager } = setup();
    const target = manager.createGraph({ name: "Target" });
    const source = manager.createGraph({ name: "Source" });
    manager.createNode(source.id, { type: KnowledgeNodeType.Agent, label: "n1" });
    const result = manager.mergeGraph(target.id, source.id);
    expect(result.mergedNodeCount).toBe(1);
  });

  it("mergeGraph validates both graphs exist", () => {
    const { manager } = setup();
    const target = manager.createGraph({ name: "Target" });
    expect(() => manager.mergeGraph(target.id, "missing")).toThrow(GraphNotFoundException);
  });

  it("extractSubGraph registers a new graph containing only the requested nodes", () => {
    const { ctx, manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    const node1 = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n1" });
    manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n2" });
    const sub = manager.extractSubGraph(graph.id, [node1.id], "Sub");
    expect(ctx.graphRegistry.get(sub.id).listNodes()).toHaveLength(1);
  });
});

describe("KnowledgeGraphManager — node CRUD", () => {
  it("createNode adds the node to the graph and the global NodeRegistry", () => {
    const { ctx, manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    const node = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n1" });
    expect(ctx.nodeRegistry.get(node.id).graphId).toBe(graph.id);
  });

  it("createNode throws for an unknown graph", () => {
    const { manager } = setup();
    expect(() =>
      manager.createNode("missing", { type: KnowledgeNodeType.Agent, label: "n1" }),
    ).toThrow(GraphNotFoundException);
  });

  it("updateNode applies a partial update and syncs the NodeRegistry", () => {
    const { ctx, manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    const node = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n1" });
    const updated = manager.updateNode(graph.id, node.id, { label: "renamed" });
    expect(updated.label).toBe("renamed");
    expect(ctx.nodeRegistry.get(node.id).node.label).toBe("renamed");
  });

  it("updateNode throws NodeNotFoundException for a missing node", () => {
    const { manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    expect(() => manager.updateNode(graph.id, "missing", { label: "x" })).toThrow(
      NodeNotFoundException,
    );
  });

  it("deleteNode cascades incident edges out of the registries", () => {
    const { ctx, manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    const node1 = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n1" });
    const node2 = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n2" });
    const edge = manager.createEdge(graph.id, {
      type: KnowledgeEdgeType.RelatedTo,
      sourceNodeId: node1.id,
      targetNodeId: node2.id,
    });
    manager.deleteNode(graph.id, node1.id);
    expect(ctx.nodeRegistry.has(node1.id)).toBe(false);
    expect(ctx.edgeRegistry.has(edge.id)).toBe(false);
  });

  it("moveNode cuts a node from one graph and inserts it, same id, into another", () => {
    const { ctx, manager } = setup();
    const fromGraph = manager.createGraph({ name: "From" });
    const toGraph = manager.createGraph({ name: "To" });
    const node = manager.createNode(fromGraph.id, { type: KnowledgeNodeType.Agent, label: "n1" });
    manager.moveNode(node.id, fromGraph.id, toGraph.id);
    expect(ctx.graphRegistry.get(fromGraph.id).hasNode(node.id)).toBe(false);
    expect(ctx.graphRegistry.get(toGraph.id).hasNode(node.id)).toBe(true);
    expect(ctx.nodeRegistry.get(node.id).graphId).toBe(toGraph.id);
  });

  it("moveNode cascades the node's incident edges out of the source graph", () => {
    const { ctx, manager } = setup();
    const fromGraph = manager.createGraph({ name: "From" });
    const toGraph = manager.createGraph({ name: "To" });
    const node1 = manager.createNode(fromGraph.id, { type: KnowledgeNodeType.Agent, label: "n1" });
    const node2 = manager.createNode(fromGraph.id, { type: KnowledgeNodeType.Agent, label: "n2" });
    const edge = manager.createEdge(fromGraph.id, {
      type: KnowledgeEdgeType.RelatedTo,
      sourceNodeId: node1.id,
      targetNodeId: node2.id,
    });
    manager.moveNode(node1.id, fromGraph.id, toGraph.id);
    expect(ctx.edgeRegistry.has(edge.id)).toBe(false);
  });

  it("copyNode duplicates type/label/metadata as a new node, without edges", () => {
    const { ctx, manager } = setup();
    const fromGraph = manager.createGraph({ name: "From" });
    const toGraph = manager.createGraph({ name: "To" });
    const node = manager.createNode(fromGraph.id, {
      type: KnowledgeNodeType.Agent,
      label: "n1",
      metadata: { a: 1 },
    });
    const copy = manager.copyNode(node.id, fromGraph.id, toGraph.id);
    expect(copy.id).not.toBe(node.id);
    expect(copy.label).toBe("n1");
    expect(copy.metadata).toEqual({ a: 1 });
    expect(ctx.graphRegistry.get(fromGraph.id).hasNode(node.id)).toBe(true);
  });

  it("findNode/findNodes read from the graph", () => {
    const { manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    const node = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n1" });
    expect(manager.findNode(graph.id, node.id).id).toBe(node.id);
    expect(manager.findNodes(graph.id)).toHaveLength(1);
    expect(manager.findNodes(graph.id, (n) => n.label === "n1")).toHaveLength(1);
    expect(manager.findNodes(graph.id, (n) => n.label === "nope")).toHaveLength(0);
  });
});

describe("KnowledgeGraphManager — edge CRUD", () => {
  it("createEdge adds the edge and mirrors it into EdgeRegistry/RelationshipRegistry", () => {
    const { ctx, manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    const node1 = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n1" });
    const node2 = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n2" });
    const edge = manager.createEdge(graph.id, {
      type: KnowledgeEdgeType.RelatedTo,
      sourceNodeId: node1.id,
      targetNodeId: node2.id,
    });
    expect(ctx.edgeRegistry.get(edge.id).graphId).toBe(graph.id);
    expect(ctx.relationshipRegistry.get(edge.id).sourceNodeId).toBe(node1.id);
  });

  it("createEdge is rejected by Cycle Detection when it would close a hierarchical cycle", () => {
    const { manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    const a = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    const b = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "B" });
    const c = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "C" });
    manager.createEdge(graph.id, {
      type: KnowledgeEdgeType.DependsOn,
      sourceNodeId: a.id,
      targetNodeId: b.id,
    });
    manager.createEdge(graph.id, {
      type: KnowledgeEdgeType.DependsOn,
      sourceNodeId: b.id,
      targetNodeId: c.id,
    });
    expect(() =>
      manager.createEdge(graph.id, {
        type: KnowledgeEdgeType.DependsOn,
        sourceNodeId: c.id,
        targetNodeId: a.id,
      }),
    ).toThrow(CycleDetectedException);
  });

  it("createEdge is rejected by Relationship Validation on an inverse-pair contradiction", () => {
    const { manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    const a = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    const b = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "B" });
    manager.createEdge(graph.id, {
      type: KnowledgeEdgeType.ParentOf,
      sourceNodeId: a.id,
      targetNodeId: b.id,
    });
    expect(() =>
      manager.createEdge(graph.id, {
        type: KnowledgeEdgeType.ChildOf,
        sourceNodeId: a.id,
        targetNodeId: b.id,
      }),
    ).toThrow(RelationshipValidationException);
  });

  it("createEdge is rejected by Authorization when the checker denies it", () => {
    const { ctx, manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    const node1 = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n1" });
    const node2 = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n2" });
    // Deny only for this specific graph, so CreateGraph/CreateNode above were unaffected.
    ctx.configurationRegistry.put(graph.id, {
      authorizationChecker: { isAuthorized: () => false },
      cycleCheckedEdgeTypes: new Set(),
      strictRelationshipValidation: true,
    });
    expect(() =>
      manager.createEdge(graph.id, {
        type: KnowledgeEdgeType.RelatedTo,
        sourceNodeId: node1.id,
        targetNodeId: node2.id,
      }),
    ).toThrow(GraphAuthorizationException);
  });

  it("updateEdge applies a partial update and syncs registries", () => {
    const { ctx, manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    const node1 = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n1" });
    const node2 = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n2" });
    const edge = manager.createEdge(graph.id, {
      type: KnowledgeEdgeType.RelatedTo,
      sourceNodeId: node1.id,
      targetNodeId: node2.id,
    });
    const updated = manager.updateEdge(graph.id, edge.id, { weight: 5 });
    expect(updated.weight).toBe(5);
    expect(ctx.relationshipRegistry.get(edge.id).weight).toBe(5);
  });

  it("updateEdge throws EdgeNotFoundException for a missing edge", () => {
    const { manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    expect(() => manager.updateEdge(graph.id, "missing", { weight: 1 })).toThrow(
      EdgeNotFoundException,
    );
  });

  it("deleteEdge removes it from the graph and both registries", () => {
    const { ctx, manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    const node1 = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n1" });
    const node2 = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n2" });
    const edge = manager.createEdge(graph.id, {
      type: KnowledgeEdgeType.RelatedTo,
      sourceNodeId: node1.id,
      targetNodeId: node2.id,
    });
    manager.deleteEdge(graph.id, edge.id);
    expect(ctx.edgeRegistry.has(edge.id)).toBe(false);
    expect(ctx.relationshipRegistry.has(edge.id)).toBe(false);
  });

  it("findEdge/findEdges read from the graph", () => {
    const { manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    const node1 = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n1" });
    const node2 = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n2" });
    const edge = manager.createEdge(graph.id, {
      type: KnowledgeEdgeType.RelatedTo,
      sourceNodeId: node1.id,
      targetNodeId: node2.id,
    });
    expect(manager.findEdge(graph.id, edge.id).id).toBe(edge.id);
    expect(manager.findEdges(graph.id)).toHaveLength(1);
    expect(manager.findEdges(graph.id, (e) => e.weight > 100)).toHaveLength(0);
  });
});

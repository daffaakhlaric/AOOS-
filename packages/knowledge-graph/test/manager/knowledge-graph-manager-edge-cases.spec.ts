import { describe, expect, it } from "vitest";

import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { KnowledgeNodeType } from "../../src/domain/knowledge-node-type.js";
import { GraphNotFoundException } from "../../src/errors/graph-not-found-exception.js";
import { NodeNotFoundException } from "../../src/errors/node-not-found-exception.js";
import { SnapshotNotFoundException } from "../../src/errors/snapshot-not-found-exception.js";
import { KnowledgeGraphManager } from "../../src/manager/knowledge-graph-manager.js";
import { buildTestContext } from "../helpers/context-fixture.js";

function setup() {
  const ctx = buildTestContext();
  const manager = new KnowledgeGraphManager(ctx);
  return { ctx, manager };
}

describe("KnowledgeGraphManager — additional edge cases", () => {
  it("createGraph honors an optional description", () => {
    const { manager } = setup();
    const graph = manager.createGraph({ name: "G1", description: "a description" });
    expect(graph.description).toBe("a description");
  });

  it("deleteNode throws NodeNotFoundException for a missing node", () => {
    const { manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    expect(() => manager.deleteNode(graph.id, "missing")).toThrow(NodeNotFoundException);
  });

  it("findNode throws NodeNotFoundException for a missing node", () => {
    const { manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    expect(() => manager.findNode(graph.id, "missing")).toThrow(NodeNotFoundException);
  });

  it("findNode/findNodes/findEdge/findEdges throw GraphNotFoundException for a missing graph", () => {
    const { manager } = setup();
    expect(() => manager.findNode("missing", "n1")).toThrow(GraphNotFoundException);
    expect(() => manager.findNodes("missing")).toThrow(GraphNotFoundException);
    expect(() => manager.findEdge("missing", "e1")).toThrow(GraphNotFoundException);
    expect(() => manager.findEdges("missing")).toThrow(GraphNotFoundException);
  });

  it("restoreGraph throws SnapshotNotFoundException for an unknown snapshot", () => {
    const { manager } = setup();
    expect(() => manager.restoreGraph("missing-snapshot")).toThrow(SnapshotNotFoundException);
  });

  it("mergeGraph supports keep-source resolution end-to-end", () => {
    // Node ids are globally unique via NodeRegistry, so a same-id conflict between two graphs can
    // only arise from direct GraphEngine mutation (e.g. two graphs assembled independently before
    // being merged) rather than manager.createNode — set it up at that level.
    const { ctx, manager } = setup();
    const target = manager.createGraph({ name: "Target" });
    const source = manager.createGraph({ name: "Source" });
    const now = Date.now();
    ctx.graphRegistry.get(target.id).addNode({
      id: "shared",
      type: KnowledgeNodeType.Agent,
      label: "target-label",
      metadata: {},
      createdAt: now,
      updatedAt: now,
    });
    ctx.graphRegistry.get(source.id).addNode({
      id: "shared",
      type: KnowledgeNodeType.Agent,
      label: "source-label",
      metadata: {},
      createdAt: now,
      updatedAt: now,
    });
    manager.mergeGraph(target.id, source.id, "keep-source");
    expect(manager.findNode(target.id, "shared").label).toBe("source-label");
  });

  it("mergeGraph supports merge-metadata resolution end-to-end", () => {
    const { ctx, manager } = setup();
    const target = manager.createGraph({ name: "Target" });
    const source = manager.createGraph({ name: "Source" });
    const now = Date.now();
    ctx.graphRegistry.get(target.id).addNode({
      id: "shared",
      type: KnowledgeNodeType.Agent,
      label: "n",
      metadata: { keep: 1 },
      createdAt: now,
      updatedAt: now,
    });
    ctx.graphRegistry.get(source.id).addNode({
      id: "shared",
      type: KnowledgeNodeType.Agent,
      label: "n",
      metadata: { added: 2 },
      createdAt: now,
      updatedAt: now,
    });
    manager.mergeGraph(target.id, source.id, "merge-metadata");
    expect(manager.findNode(target.id, "shared").metadata).toEqual({ keep: 1, added: 2 });
  });

  it("copyNode can copy into the same graph it came from", () => {
    const { manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    const node = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n1" });
    const copy = manager.copyNode(node.id, graph.id, graph.id);
    expect(copy.id).not.toBe(node.id);
    expect(manager.findNodes(graph.id)).toHaveLength(2);
  });

  it("moveNode throws NodeNotFoundException for a missing node in the source graph", () => {
    const { manager } = setup();
    const fromGraph = manager.createGraph({ name: "From" });
    const toGraph = manager.createGraph({ name: "To" });
    expect(() => manager.moveNode("missing", fromGraph.id, toGraph.id)).toThrow(
      NodeNotFoundException,
    );
  });

  it("extractSubGraph throws GraphNotFoundException for a missing source graph", () => {
    const { manager } = setup();
    expect(() => manager.extractSubGraph("missing", [], "Sub")).toThrow(GraphNotFoundException);
  });

  it("snapshotGraph without a label leaves label undefined", () => {
    const { manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    const snapshot = manager.snapshotGraph(graph.id);
    expect(snapshot.label).toBeUndefined();
  });

  it("createEdge/updateEdge/deleteEdge/findEdge round-trip weight and metadata", () => {
    const { manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    const a = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    const b = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "B" });
    const edge = manager.createEdge(graph.id, {
      type: KnowledgeEdgeType.Uses,
      sourceNodeId: a.id,
      targetNodeId: b.id,
      weight: 2,
      metadata: { note: "x" },
    });
    expect(manager.findEdge(graph.id, edge.id).metadata).toEqual({ note: "x" });
    const updated = manager.updateEdge(graph.id, edge.id, { metadata: { note: "y" } });
    expect(updated.weight).toBe(2);
    expect(updated.metadata).toEqual({ note: "y" });
  });
});

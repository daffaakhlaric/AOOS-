import { describe, expect, it } from "vitest";

import { KnowledgeNodeType } from "../../src/domain/knowledge-node-type.js";
import { KnowledgeGraphManager } from "../../src/manager/knowledge-graph-manager.js";
import { buildTestContext } from "../helpers/context-fixture.js";

function setup() {
  const ctx = buildTestContext();
  const manager = new KnowledgeGraphManager(ctx);
  return { ctx, manager };
}

describe("KnowledgeGraphManager — further coverage", () => {
  it("updateNode with only metadata leaves label untouched", () => {
    const { manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    const node = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n1" });
    const updated = manager.updateNode(graph.id, node.id, { metadata: { a: 1 } });
    expect(updated.label).toBe("n1");
    expect(updated.metadata).toEqual({ a: 1 });
  });

  it("findNodes/findEdges default to returning every entry with no predicate", () => {
    const { manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n1" });
    manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n2" });
    expect(manager.findNodes(graph.id)).toHaveLength(2);
    expect(manager.findEdges(graph.id)).toHaveLength(0);
  });

  it("moveNode from a graph to itself keeps the node registered under that graph", () => {
    const { ctx, manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    const node = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n1" });
    manager.moveNode(node.id, graph.id, graph.id);
    expect(ctx.graphRegistry.get(graph.id).hasNode(node.id)).toBe(true);
    expect(ctx.nodeRegistry.get(node.id).graphId).toBe(graph.id);
  });

  it("copyNode preserves a Custom type's customTypeLabel", () => {
    const { manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    const node = manager.createNode(graph.id, {
      type: KnowledgeNodeType.Custom,
      customTypeLabel: "Widget",
      label: "n1",
    });
    const copy = manager.copyNode(node.id, graph.id, graph.id);
    expect(copy.type).toBe(KnowledgeNodeType.Custom);
    expect(copy.customTypeLabel).toBe("Widget");
  });

  it("snapshotGraph on an empty graph produces an empty snapshot", () => {
    const { manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    const snapshot = manager.snapshotGraph(graph.id);
    expect(snapshot.nodes).toEqual([]);
    expect(snapshot.edges).toEqual([]);
  });

  it("mergeGraph against an empty source graph is a no-op merge", () => {
    const { manager } = setup();
    const target = manager.createGraph({ name: "Target" });
    manager.createNode(target.id, { type: KnowledgeNodeType.Agent, label: "n1" });
    const source = manager.createGraph({ name: "Source" });
    const result = manager.mergeGraph(target.id, source.id);
    expect(result.mergedNodeCount).toBe(0);
    expect(result.mergedEdgeCount).toBe(0);
    expect(manager.findNodes(target.id)).toHaveLength(1);
  });

  it("extractSubGraph tolerates a nodeIds list containing an id not present in the source", () => {
    const { manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    const node = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n1" });
    const sub = manager.extractSubGraph(graph.id, [node.id, "does-not-exist"], "Sub");
    expect(manager.findNodes(sub.id)).toHaveLength(1);
  });

  it("cloneGraph of an empty graph produces an empty clone", () => {
    const { manager } = setup();
    const graph = manager.createGraph({ name: "G1" });
    const cloned = manager.cloneGraph(graph.id);
    expect(manager.findNodes(cloned.id)).toEqual([]);
  });
});

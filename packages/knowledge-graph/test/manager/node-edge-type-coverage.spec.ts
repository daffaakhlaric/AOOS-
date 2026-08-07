import { describe, expect, it } from "vitest";

import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { KnowledgeNodeType } from "../../src/domain/knowledge-node-type.js";
import { KnowledgeGraphManager } from "../../src/manager/knowledge-graph-manager.js";
import { buildTestContext } from "../helpers/context-fixture.js";

const ALL_NODE_TYPES = Object.values(KnowledgeNodeType);
const ALL_EDGE_TYPES = Object.values(KnowledgeEdgeType);

describe("KnowledgeGraphManager.createNode — every catalogued node type", () => {
  it.each(ALL_NODE_TYPES)("creates a %s node end-to-end through the pipeline", (type) => {
    const ctx = buildTestContext();
    const manager = new KnowledgeGraphManager(ctx);
    const graph = manager.createGraph({ name: "G1" });
    const input =
      type === KnowledgeNodeType.Custom
        ? { type, label: "n", customTypeLabel: "X" }
        : { type, label: "n" };
    const node = manager.createNode(graph.id, input);
    expect(node.type).toBe(type);
    expect(ctx.nodeRegistry.get(node.id).node.type).toBe(type);
  });
});

describe("KnowledgeGraphManager.createEdge — every catalogued edge type", () => {
  it.each(ALL_EDGE_TYPES)("creates a %s edge end-to-end through the pipeline", (type) => {
    const ctx = buildTestContext();
    const manager = new KnowledgeGraphManager(ctx);
    const graph = manager.createGraph({ name: "G1" });
    const a = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    const b = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "B" });
    const input =
      type === KnowledgeEdgeType.Custom
        ? { type, sourceNodeId: a.id, targetNodeId: b.id, customTypeLabel: "X" }
        : { type, sourceNodeId: a.id, targetNodeId: b.id };
    const edge = manager.createEdge(graph.id, input);
    expect(edge.type).toBe(type);
    expect(ctx.edgeRegistry.get(edge.id).edge.type).toBe(type);
    expect(ctx.relationshipRegistry.get(edge.id).type).toBe(type);
  });
});

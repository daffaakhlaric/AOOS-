import { describe, expect, it } from "vitest";

import { KnowledgeNodeType } from "../../src/domain/knowledge-node-type.js";
import { HIERARCHICAL_EDGE_TYPES } from "../../src/edges/edge-type-semantics.js";
import { CycleDetectedException } from "../../src/errors/cycle-detected-exception.js";
import { KnowledgeGraphManager } from "../../src/manager/knowledge-graph-manager.js";
import { buildTestContext } from "../helpers/context-fixture.js";

describe("KnowledgeGraphManager.createEdge — Cycle Detection per hierarchical edge type", () => {
  it.each(Array.from(HIERARCHICAL_EDGE_TYPES))(
    "rejects a %s edge that would close a 3-node cycle",
    (edgeType) => {
      const ctx = buildTestContext();
      const manager = new KnowledgeGraphManager(ctx);
      const graph = manager.createGraph({ name: "G1" });
      const a = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
      const b = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "B" });
      const c = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "C" });
      manager.createEdge(graph.id, { type: edgeType, sourceNodeId: a.id, targetNodeId: b.id });
      manager.createEdge(graph.id, { type: edgeType, sourceNodeId: b.id, targetNodeId: c.id });
      expect(() =>
        manager.createEdge(graph.id, { type: edgeType, sourceNodeId: c.id, targetNodeId: a.id }),
      ).toThrow(CycleDetectedException);
    },
  );

  it.each(Array.from(HIERARCHICAL_EDGE_TYPES))(
    "accepts a %s edge that does not close a cycle",
    (edgeType) => {
      const ctx = buildTestContext();
      const manager = new KnowledgeGraphManager(ctx);
      const graph = manager.createGraph({ name: "G1" });
      const a = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
      const b = manager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "B" });
      const edge = manager.createEdge(graph.id, {
        type: edgeType,
        sourceNodeId: a.id,
        targetNodeId: b.id,
      });
      expect(edge.type).toBe(edgeType);
    },
  );
});

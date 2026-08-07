import { describe, expect, it } from "vitest";

import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { KnowledgeNodeType } from "../../src/domain/knowledge-node-type.js";
import { KnowledgeGraphManager } from "../../src/manager/knowledge-graph-manager.js";
import { ReasoningManager } from "../../src/manager/reasoning-manager.js";
import { buildTestContext } from "../helpers/context-fixture.js";

function setup() {
  const ctx = buildTestContext();
  const graphManager = new KnowledgeGraphManager(ctx);
  const reasoningManager = new ReasoningManager(ctx);
  return { graphManager, reasoningManager };
}

describe("ReasoningManager", () => {
  it("findDependencies/findDependents/impactAnalysis over a DependsOn chain", () => {
    const { graphManager, reasoningManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    const a = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    const b = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "B" });
    const c = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "C" });
    graphManager.createEdge(graph.id, {
      type: KnowledgeEdgeType.DependsOn,
      sourceNodeId: a.id,
      targetNodeId: b.id,
    });
    graphManager.createEdge(graph.id, {
      type: KnowledgeEdgeType.DependsOn,
      sourceNodeId: b.id,
      targetNodeId: c.id,
    });

    expect(reasoningManager.findDependencies(graph.id, a.id).sort()).toEqual([b.id, c.id].sort());
    expect(reasoningManager.findDependents(graph.id, c.id).sort()).toEqual([a.id, b.id].sort());

    const impact = reasoningManager.impactAnalysis(graph.id, c.id);
    expect(impact.impactedNodeIds.sort()).toEqual([a.id, b.id].sort());
    expect(impact.impactedCount).toBe(2);
  });
});

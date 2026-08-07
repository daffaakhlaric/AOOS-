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

describe("ReasoningManager — further coverage", () => {
  it("findDependencies on a node with no dependencies returns an empty array", () => {
    const { graphManager, reasoningManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    const node = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    expect(reasoningManager.findDependencies(graph.id, node.id)).toEqual([]);
  });

  it("findDependents on a node with no dependents returns an empty array", () => {
    const { graphManager, reasoningManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    const node = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    expect(reasoningManager.findDependents(graph.id, node.id)).toEqual([]);
  });

  it("impactAnalysis on a node with no dependents reports zero impact", () => {
    const { graphManager, reasoningManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    const node = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    const result = reasoningManager.impactAnalysis(graph.id, node.id);
    expect(result.impactedCount).toBe(0);
    expect(result.impactedNodeIds).toEqual([]);
  });

  it("non-dependency edge types (e.g. RelatedTo) are excluded from dependency reasoning", () => {
    const { graphManager, reasoningManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    const a = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    const b = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "B" });
    graphManager.createEdge(graph.id, {
      type: KnowledgeEdgeType.RelatedTo,
      sourceNodeId: a.id,
      targetNodeId: b.id,
    });
    expect(reasoningManager.findDependencies(graph.id, a.id)).toEqual([]);
  });

  it("impactAnalysis over a diamond dependency shape reports every transitive dependent once", () => {
    const { graphManager, reasoningManager } = setup();
    const graph = graphManager.createGraph({ name: "G1" });
    const top = graphManager.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "Top" });
    const left = graphManager.createNode(graph.id, {
      type: KnowledgeNodeType.Agent,
      label: "Left",
    });
    const right = graphManager.createNode(graph.id, {
      type: KnowledgeNodeType.Agent,
      label: "Right",
    });
    const bottom = graphManager.createNode(graph.id, {
      type: KnowledgeNodeType.Agent,
      label: "Bottom",
    });
    graphManager.createEdge(graph.id, {
      type: KnowledgeEdgeType.DependsOn,
      sourceNodeId: top.id,
      targetNodeId: left.id,
    });
    graphManager.createEdge(graph.id, {
      type: KnowledgeEdgeType.DependsOn,
      sourceNodeId: top.id,
      targetNodeId: right.id,
    });
    graphManager.createEdge(graph.id, {
      type: KnowledgeEdgeType.DependsOn,
      sourceNodeId: left.id,
      targetNodeId: bottom.id,
    });
    graphManager.createEdge(graph.id, {
      type: KnowledgeEdgeType.DependsOn,
      sourceNodeId: right.id,
      targetNodeId: bottom.id,
    });

    const impact = reasoningManager.impactAnalysis(graph.id, bottom.id);
    expect(impact.impactedNodeIds.sort()).toEqual([left.id, right.id, top.id].sort());
    expect(impact.impactedCount).toBe(3);
  });
});

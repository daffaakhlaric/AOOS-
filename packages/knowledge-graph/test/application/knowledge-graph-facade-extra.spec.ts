import { describe, expect, it } from "vitest";

import { KnowledgeGraph } from "../../src/application/knowledge-graph-facade.js";
import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { KnowledgeNodeType } from "../../src/domain/knowledge-node-type.js";

describe("KnowledgeGraph facade — deeper integration flows", () => {
  it("clone -> snapshot -> mutate -> restore round trip via the facade", () => {
    const kg = new KnowledgeGraph();
    const graph = kg.graphs.createGraph({ name: "G1" });
    const a = kg.graphs.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    const snapshot = kg.graphs.snapshotGraph(graph.id, "before");
    kg.graphs.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "B" });
    expect(kg.graphs.findNodes(graph.id)).toHaveLength(2);

    kg.graphs.restoreGraph(snapshot.id);
    expect(kg.graphs.findNodes(graph.id).map((n) => n.id)).toEqual([a.id]);
  });

  it("merge two facade-created graphs with disjoint nodes", () => {
    const kg = new KnowledgeGraph();
    const target = kg.graphs.createGraph({ name: "Target" });
    const source = kg.graphs.createGraph({ name: "Source" });
    kg.graphs.createNode(source.id, { type: KnowledgeNodeType.Agent, label: "S1" });
    const result = kg.graphs.mergeGraph(target.id, source.id);
    expect(result.mergedNodeCount).toBe(1);
    expect(kg.graphs.findNodes(target.id)).toHaveLength(1);
  });

  it("subGraph extraction is reachable via traversal manager on the facade", () => {
    const kg = new KnowledgeGraph();
    const graph = kg.graphs.createGraph({ name: "G1" });
    const a = kg.graphs.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    const sub = kg.traversal.subGraph(graph.id, [a.id], "Sub");
    expect(kg.graphs.findNodes(sub.id)).toHaveLength(1);
  });

  it("impact analysis flows end-to-end via the facade", () => {
    const kg = new KnowledgeGraph();
    const graph = kg.graphs.createGraph({ name: "G1" });
    const a = kg.graphs.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    const b = kg.graphs.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "B" });
    kg.relationships.connect(graph.id, a.id, b.id, KnowledgeEdgeType.DependsOn);
    const impact = kg.reasoning.impactAnalysis(graph.id, b.id);
    expect(impact.impactedNodeIds).toEqual([a.id]);
  });

  it("connectedComponents/cycleDetection/graphValidation are reachable via the facade", () => {
    const kg = new KnowledgeGraph();
    const graph = kg.graphs.createGraph({ name: "G1" });
    kg.graphs.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    expect(kg.analytics.connectedComponents(graph.id)).toHaveLength(1);
    expect(kg.analytics.cycleDetection(graph.id).hasCycle).toBe(false);
    expect(kg.analytics.graphValidation(graph.id).valid).toBe(true);
  });
});

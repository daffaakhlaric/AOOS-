import { describe, expect, it } from "vitest";

import { KnowledgeGraphAnalytics } from "../../src/analytics/knowledge-graph-analytics.js";

describe("KnowledgeGraphAnalytics edge cases", () => {
  it("computes average degree of 0 for an edgeless graph", () => {
    const graph = new KnowledgeGraphAnalytics();
    graph.recordGraphSnapshot({ nodeCount: 5, edgeCount: 0, connectedComponents: 5 });
    expect(graph.averageGraphDegree()).toBe(0);
  });

  it("computes average degree for a densely connected graph", () => {
    const graph = new KnowledgeGraphAnalytics();
    // Complete graph K5 has 10 edges: degree = (2*10)/5 = 4
    graph.recordGraphSnapshot({ nodeCount: 5, edgeCount: 10, connectedComponents: 1 });
    expect(graph.averageGraphDegree()).toBe(4);
  });

  it("only the latest snapshot's readings are exposed, older snapshots are not averaged in", () => {
    const graph = new KnowledgeGraphAnalytics();
    graph.recordGraphSnapshot({ nodeCount: 100, edgeCount: 100, connectedComponents: 1 });
    graph.recordGraphSnapshot({ nodeCount: 2, edgeCount: 1, connectedComponents: 1 });
    expect(graph.latestNodeCount()).toBe(2);
    expect(graph.averageGraphDegree()).toBe(1);
  });
});

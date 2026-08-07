import { describe, expect, it } from "vitest";

import { KnowledgeGraphAnalytics } from "../../src/analytics/knowledge-graph-analytics.js";

describe("KnowledgeGraphAnalytics", () => {
  it("returns 0 for every metric with no recordings", () => {
    const graph = new KnowledgeGraphAnalytics();
    expect(graph.latestNodeCount()).toBe(0);
    expect(graph.latestEdgeCount()).toBe(0);
    expect(graph.latestConnectedComponents()).toBe(0);
    expect(graph.averageGraphDegree()).toBe(0);
  });

  it("tracks the latest node/edge/connected-components reading, not a sum", () => {
    const graph = new KnowledgeGraphAnalytics();
    graph.recordGraphSnapshot({ nodeCount: 10, edgeCount: 15, connectedComponents: 1 });
    graph.recordGraphSnapshot({ nodeCount: 12, edgeCount: 20, connectedComponents: 2 });
    expect(graph.latestNodeCount()).toBe(12);
    expect(graph.latestEdgeCount()).toBe(20);
    expect(graph.latestConnectedComponents()).toBe(2);
  });

  it("computes average graph degree as (2 * edges) / nodes", () => {
    const graph = new KnowledgeGraphAnalytics();
    graph.recordGraphSnapshot({ nodeCount: 4, edgeCount: 3, connectedComponents: 1 });
    // (2*3)/4 = 1.5
    expect(graph.averageGraphDegree()).toBe(1.5);
  });

  it("computes 0 average degree when nodeCount is 0", () => {
    const graph = new KnowledgeGraphAnalytics();
    graph.recordGraphSnapshot({ nodeCount: 0, edgeCount: 0, connectedComponents: 0 });
    expect(graph.averageGraphDegree()).toBe(0);
  });

  it("summary reports every owned metric", () => {
    const graph = new KnowledgeGraphAnalytics();
    graph.recordGraphSnapshot({ nodeCount: 4, edgeCount: 3, connectedComponents: 1 });
    expect(graph.summary()).toEqual({
      nodeCount: 4,
      edgeCount: 3,
      connectedComponents: 1,
      averageGraphDegree: 1.5,
    });
  });
});

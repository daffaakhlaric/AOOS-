import { describe, expect, it } from "vitest";

import { calculateGraphStatistics } from "../../src/analytics/graph-statistics-calculator.js";
import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { addEdge, buildDagEngine } from "../helpers/graph-fixtures.js";

describe("calculateGraphStatistics", () => {
  it("computes counts, degree, components, cycles, and type breakdowns for the DAG fixture", () => {
    const engine = buildDagEngine();
    const stats = calculateGraphStatistics(engine);

    expect(stats.graphId).toBe(engine.graph.id);
    expect(stats.nodeCount).toBe(4);
    expect(stats.edgeCount).toBe(4);
    expect(stats.averageDegree).toBe(2);
    expect(stats.connectedComponentCount).toBe(1);
    expect(stats.cycleCount).toBe(0);
    expect(stats.nodeTypeBreakdown).toEqual({ Knowledge: 4 });
    expect(stats.edgeTypeBreakdown).toEqual({ DependsOn: 4 });
    expect(typeof stats.computedAt).toBe("number");
  });

  it("breaks down multiple edge types separately", () => {
    const engine = buildDagEngine();
    addEdge(engine, "D", "A", KnowledgeEdgeType.RelatedTo);
    const stats = calculateGraphStatistics(engine);
    expect(stats.edgeTypeBreakdown).toEqual({ DependsOn: 4, RelatedTo: 1 });
    expect(stats.cycleCount).toBeGreaterThan(0);
  });
});

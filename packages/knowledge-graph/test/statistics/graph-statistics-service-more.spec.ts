import { describe, expect, it } from "vitest";

import { GraphEngine } from "../../src/graph/graph-engine.js";
import { GraphStatisticsService } from "../../src/statistics/graph-statistics-service.js";
import { buildDisjointComponentsEngine } from "../helpers/graph-fixtures.js";

describe("GraphStatisticsService — additional coverage", () => {
  it("computes statistics for an empty graph", () => {
    const service = new GraphStatisticsService();
    const engine = GraphEngine.create({ name: "empty" });
    const stats = service.compute(engine);
    expect(stats.nodeCount).toBe(0);
    expect(stats.edgeCount).toBe(0);
    expect(stats.averageDegree).toBe(0);
    expect(stats.connectedComponentCount).toBe(0);
  });

  it("computes statistics for the disjoint-components fixture", () => {
    const service = new GraphStatisticsService();
    const stats = service.compute(buildDisjointComponentsEngine());
    expect(stats.connectedComponentCount).toBe(3);
  });
});

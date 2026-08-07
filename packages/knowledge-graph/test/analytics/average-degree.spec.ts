import { describe, expect, it } from "vitest";

import { computeAverageDegree } from "../../src/analytics/average-degree.js";
import { GraphEngine } from "../../src/graph/graph-engine.js";
import { buildDagEngine } from "../helpers/graph-fixtures.js";

describe("computeAverageDegree", () => {
  it("returns 0 for an empty graph", () => {
    const engine = GraphEngine.create({ name: "empty" });
    expect(computeAverageDegree(engine)).toBe(0);
  });

  it("returns 0 for a graph with nodes but no edges", () => {
    const engine = GraphEngine.create({ name: "g" });
    engine.addNode({
      id: "n1",
      type: buildDagEngine().getNode("A").type,
      label: "n1",
      metadata: {},
      createdAt: 0,
      updatedAt: 0,
    });
    expect(computeAverageDegree(engine)).toBe(0);
  });

  it("computes (edgeCount * 2) / nodeCount for the DAG fixture (4 edges, 4 nodes)", () => {
    const engine = buildDagEngine();
    expect(computeAverageDegree(engine)).toBe((4 * 2) / 4);
  });
});

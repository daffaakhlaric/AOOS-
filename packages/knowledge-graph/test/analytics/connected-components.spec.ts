import { describe, expect, it } from "vitest";

import { findConnectedComponents } from "../../src/analytics/connected-components.js";
import { GraphEngine } from "../../src/graph/graph-engine.js";
import { buildDagEngine, buildDisjointComponentsEngine } from "../helpers/graph-fixtures.js";

describe("findConnectedComponents", () => {
  it("a fully connected graph is a single component", () => {
    const engine = buildDagEngine();
    const clusters = findConnectedComponents(engine);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.size).toBe(4);
  });

  it("finds 3 components: sizes 3, 2, and 1 (isolated node)", () => {
    const engine = buildDisjointComponentsEngine();
    const clusters = findConnectedComponents(engine);
    expect(clusters).toHaveLength(3);
    expect(clusters.map((c) => c.size).sort()).toEqual([1, 2, 3]);
    const sizeThree = clusters.find((c) => c.size === 3);
    expect(sizeThree?.nodeIds.sort()).toEqual(["M1", "M2", "M3"]);
    const sizeOne = clusters.find((c) => c.size === 1);
    expect(sizeOne?.nodeIds).toEqual(["O"]);
  });

  it("treats edges as undirected for component grouping", () => {
    const engine = buildDagEngine();
    // A->B is a directed edge but both nodes must land in the same weakly-connected component.
    const clusters = findConnectedComponents(engine);
    const clusterOfA = clusters.find((c) => c.nodeIds.includes("A"));
    expect(clusterOfA?.nodeIds).toContain("B");
  });

  it("returns an empty array for an empty graph", () => {
    const engine = GraphEngine.create({ name: "empty" });
    expect(findConnectedComponents(engine)).toEqual([]);
  });

  it("each cluster gets a unique generated id", () => {
    const engine = buildDisjointComponentsEngine();
    const clusters = findConnectedComponents(engine);
    const ids = new Set(clusters.map((c) => c.id));
    expect(ids.size).toBe(clusters.length);
  });
});

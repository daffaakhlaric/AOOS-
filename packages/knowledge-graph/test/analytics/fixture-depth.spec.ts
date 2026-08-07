import { describe, expect, it } from "vitest";

import { computeAverageDegree } from "../../src/analytics/average-degree.js";
import { findConnectedComponents } from "../../src/analytics/connected-components.js";
import { detectCycles } from "../../src/analytics/cycle-detection.js";
import { calculateGraphStatistics } from "../../src/analytics/graph-statistics-calculator.js";
import {
  buildCycleCandidateEngine,
  buildDisjointComponentsEngine,
  buildMultiPathEngine,
} from "../helpers/graph-fixtures.js";

describe("analytics — over the disjoint-components fixture", () => {
  it("averageDegree counts every edge across all components", () => {
    const engine = buildDisjointComponentsEngine();
    // 3 edges total (M1-M2, M2-M3, N1-N2), 6 nodes.
    expect(computeAverageDegree(engine)).toBe((3 * 2) / 6);
  });

  it("has no cycles", () => {
    const engine = buildDisjointComponentsEngine();
    expect(detectCycles(engine).hasCycle).toBe(false);
  });

  it("statistics report 3 components and 0 cycles", () => {
    const engine = buildDisjointComponentsEngine();
    const stats = calculateGraphStatistics(engine);
    expect(stats.connectedComponentCount).toBe(3);
    expect(stats.cycleCount).toBe(0);
    expect(stats.nodeCount).toBe(6);
  });
});

describe("analytics — over the multi-path fixture", () => {
  it("is a single connected component", () => {
    const engine = buildMultiPathEngine();
    expect(findConnectedComponents(engine)).toHaveLength(1);
  });

  it("has no cycles (all edges point the same direction)", () => {
    const engine = buildMultiPathEngine();
    expect(detectCycles(engine).hasCycle).toBe(false);
  });
});

describe("analytics — over the cycle-candidate fixture", () => {
  it("has no cycles until the closing edge is added", () => {
    const engine = buildCycleCandidateEngine();
    expect(detectCycles(engine).hasCycle).toBe(false);
  });

  it("W is its own isolated component alongside the X-Y-Z chain", () => {
    const engine = buildCycleCandidateEngine();
    const clusters = findConnectedComponents(engine);
    expect(clusters).toHaveLength(2);
    expect(clusters.map((c) => c.size).sort()).toEqual([1, 3]);
  });
});

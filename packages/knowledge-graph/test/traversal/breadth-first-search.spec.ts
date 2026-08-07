import { describe, expect, it } from "vitest";

import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { NodeNotFoundException } from "../../src/errors/node-not-found-exception.js";
import { breadthFirstSearch } from "../../src/traversal/breadth-first-search.js";
import { buildDagEngine } from "../helpers/graph-fixtures.js";

describe("breadthFirstSearch", () => {
  it("visits every reachable node in BFS (shallowest-first) order", () => {
    const engine = buildDagEngine();
    const result = breadthFirstSearch(engine, "A");
    expect(result.algorithm).toBe("bfs");
    expect(result.visitedOrder[0]).toBe("A");
    expect(new Set(result.visitedOrder)).toEqual(new Set(["A", "B", "C", "D"]));
    // B and C are both depth 1 from A, so they must appear before D (depth 2).
    expect(result.visitedOrder.indexOf("D")).toBeGreaterThan(result.visitedOrder.indexOf("B"));
    expect(result.visitedOrder.indexOf("D")).toBeGreaterThan(result.visitedOrder.indexOf("C"));
  });

  it("does not revisit an already-visited node reachable via multiple paths", () => {
    const engine = buildDagEngine();
    const result = breadthFirstSearch(engine, "A");
    expect(result.visitedOrder.filter((id) => id === "C")).toHaveLength(1);
  });

  it("throws NodeNotFoundException for a missing start node", () => {
    const engine = buildDagEngine();
    expect(() => breadthFirstSearch(engine, "missing")).toThrow(NodeNotFoundException);
  });

  it("respects maxDepth", () => {
    const engine = buildDagEngine();
    const result = breadthFirstSearch(engine, "A", { maxDepth: 1 });
    expect(new Set(result.visitedOrder)).toEqual(new Set(["A", "B", "C"]));
    expect(result.visitedOrder).not.toContain("D");
  });

  it("filters traversal to specific edge types", () => {
    const engine = buildDagEngine();
    const result = breadthFirstSearch(engine, "A", { edgeTypes: [KnowledgeEdgeType.RelatedTo] });
    expect(result.visitedOrder).toEqual(["A"]);
  });

  it("a graph with a single node visits only itself", () => {
    const engine = buildDagEngine();
    const result = breadthFirstSearch(engine, "D");
    expect(result.visitedOrder).toEqual(["D"]);
  });

  it("records a non-negative duration", () => {
    const engine = buildDagEngine();
    const result = breadthFirstSearch(engine, "A");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});

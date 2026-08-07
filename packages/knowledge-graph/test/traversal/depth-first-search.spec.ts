import { describe, expect, it } from "vitest";

import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { NodeNotFoundException } from "../../src/errors/node-not-found-exception.js";
import { depthFirstSearch } from "../../src/traversal/depth-first-search.js";
import { buildDagEngine } from "../helpers/graph-fixtures.js";

describe("depthFirstSearch", () => {
  it("visits every reachable node exactly once", () => {
    const engine = buildDagEngine();
    const result = depthFirstSearch(engine, "A");
    expect(result.algorithm).toBe("dfs");
    expect(result.visitedOrder[0]).toBe("A");
    expect(new Set(result.visitedOrder)).toEqual(new Set(["A", "B", "C", "D"]));
    expect(result.visitedOrder).toHaveLength(4);
  });

  it("does not revisit a node reached via a second path", () => {
    const engine = buildDagEngine();
    const result = depthFirstSearch(engine, "A");
    expect(result.visitedOrder.filter((id) => id === "C")).toHaveLength(1);
  });

  it("throws NodeNotFoundException for a missing start node", () => {
    const engine = buildDagEngine();
    expect(() => depthFirstSearch(engine, "missing")).toThrow(NodeNotFoundException);
  });

  it("respects maxDepth", () => {
    const engine = buildDagEngine();
    const result = depthFirstSearch(engine, "A", { maxDepth: 0 });
    expect(result.visitedOrder).toEqual(["A"]);
  });

  it("filters traversal to specific edge types", () => {
    const engine = buildDagEngine();
    const result = depthFirstSearch(engine, "A", { edgeTypes: [KnowledgeEdgeType.RelatedTo] });
    expect(result.visitedOrder).toEqual(["A"]);
  });

  it("visits a leaf node with no outgoing edges as just itself", () => {
    const engine = buildDagEngine();
    const result = depthFirstSearch(engine, "D");
    expect(result.visitedOrder).toEqual(["D"]);
  });

  it("handles a node with a single, already-visited-later neighbor without error", () => {
    const engine = buildDagEngine();
    const result = depthFirstSearch(engine, "B");
    expect(new Set(result.visitedOrder)).toEqual(new Set(["B", "C", "D"]));
  });
});

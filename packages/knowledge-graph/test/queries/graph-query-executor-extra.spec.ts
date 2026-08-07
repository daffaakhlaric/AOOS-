import { describe, expect, it } from "vitest";

import type { GraphPath } from "../../src/domain/graph-path.js";
import type { GraphTraversal } from "../../src/domain/graph-traversal.js";
import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { KnowledgeNodeType } from "../../src/domain/knowledge-node-type.js";
import type { KnowledgeNode } from "../../src/domain/knowledge-node.js";
import { executeGraphQuery } from "../../src/queries/graph-query-executor.js";
import { buildDagEngine, buildMultiPathEngine } from "../helpers/graph-fixtures.js";

describe("executeGraphQuery — additional scenarios", () => {
  it("Filter: combining nodeType AND edgeType applies both predicates", () => {
    const engine = buildDagEngine();
    const result = executeGraphQuery(engine, {
      kind: "Filter",
      nodeType: KnowledgeNodeType.Knowledge,
      edgeType: KnowledgeEdgeType.DependsOn,
    }) as KnowledgeNode[];
    expect(result.map((n) => n.id).sort()).toEqual(["A", "B", "C", "D"]);
  });

  it("Filter: a node type with zero matches returns an empty array", () => {
    const engine = buildDagEngine();
    const result = executeGraphQuery(engine, {
      kind: "Filter",
      nodeType: KnowledgeNodeType.Tool,
    }) as KnowledgeNode[];
    expect(result).toEqual([]);
  });

  it("Search: no match returns an empty array", () => {
    const engine = buildDagEngine();
    const result = executeGraphQuery(engine, { kind: "Search", text: "zzz" }) as KnowledgeNode[];
    expect(result).toEqual([]);
  });

  it("TraversalQuery: respects maxDepth", () => {
    const engine = buildDagEngine();
    const result = executeGraphQuery(engine, {
      kind: "TraversalQuery",
      algorithm: "bfs",
      startNodeId: "A",
      maxDepth: 1,
    }) as GraphTraversal;
    expect(result.visitedOrder).not.toContain("D");
  });

  it("PathQuery: returns undefined when there is no path", () => {
    const engine = buildDagEngine();
    const result = executeGraphQuery(engine, {
      kind: "PathQuery",
      startNodeId: "D",
      endNodeId: "A",
    }) as GraphPath | undefined;
    expect(result).toBeUndefined();
  });

  it("PathQuery: over the multi-path fixture prefers the shortcut", () => {
    const engine = buildMultiPathEngine();
    const result = executeGraphQuery(engine, {
      kind: "PathQuery",
      startNodeId: "S",
      endNodeId: "T",
    }) as GraphPath;
    expect(result.length).toBe(1);
  });
});

import { describe, expect, it } from "vitest";

import type { CycleDetectionResult } from "../../src/analytics/cycle-detection.js";
import type { GraphCluster } from "../../src/domain/graph-cluster.js";
import type { GraphPath } from "../../src/domain/graph-path.js";
import type { GraphRelationship } from "../../src/domain/graph-relationship.js";
import type { GraphStatistics } from "../../src/domain/graph-statistics.js";
import type { GraphTraversal } from "../../src/domain/graph-traversal.js";
import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { KnowledgeNodeType } from "../../src/domain/knowledge-node-type.js";
import type { KnowledgeNode } from "../../src/domain/knowledge-node.js";
import { GraphValidationException } from "../../src/errors/graph-validation-exception.js";
import { executeGraphQuery } from "../../src/queries/graph-query-executor.js";
import { buildDagEngine } from "../helpers/graph-fixtures.js";

describe("executeGraphQuery", () => {
  it("Filter: matches by node type", () => {
    const engine = buildDagEngine();
    const result = executeGraphQuery(engine, {
      kind: "Filter",
      nodeType: KnowledgeNodeType.Knowledge,
    }) as KnowledgeNode[];
    expect(result).toHaveLength(4);
  });

  it("Filter: matches by edge type (node participates in an edge of that type)", () => {
    const engine = buildDagEngine();
    const result = executeGraphQuery(engine, {
      kind: "Filter",
      edgeType: KnowledgeEdgeType.DependsOn,
    }) as KnowledgeNode[];
    expect(result.map((n) => n.id).sort()).toEqual(["A", "B", "C", "D"]);
  });

  it("Filter: no criteria returns every node", () => {
    const engine = buildDagEngine();
    const result = executeGraphQuery(engine, { kind: "Filter" }) as KnowledgeNode[];
    expect(result).toHaveLength(4);
  });

  it("Search: case-insensitive substring match on label", () => {
    const engine = buildDagEngine();
    const result = executeGraphQuery(engine, { kind: "Search", text: "b" }) as KnowledgeNode[];
    expect(result.map((n) => n.id)).toEqual(["B"]);
  });

  it("TraversalQuery: dispatches to bfs", () => {
    const engine = buildDagEngine();
    const result = executeGraphQuery(engine, {
      kind: "TraversalQuery",
      algorithm: "bfs",
      startNodeId: "A",
    }) as GraphTraversal;
    expect(result.algorithm).toBe("bfs");
  });

  it("TraversalQuery: dispatches to dfs", () => {
    const engine = buildDagEngine();
    const result = executeGraphQuery(engine, {
      kind: "TraversalQuery",
      algorithm: "dfs",
      startNodeId: "A",
    }) as GraphTraversal;
    expect(result.algorithm).toBe("dfs");
  });

  it("PathQuery: dispatches to shortestPath", () => {
    const engine = buildDagEngine();
    const result = executeGraphQuery(engine, {
      kind: "PathQuery",
      startNodeId: "A",
      endNodeId: "D",
    }) as GraphPath;
    expect(result.nodeIds[0]).toBe("A");
  });

  it("RelationshipQuery: by nodeId", () => {
    const engine = buildDagEngine();
    const result = executeGraphQuery(engine, {
      kind: "RelationshipQuery",
      nodeId: "A",
    }) as GraphRelationship[];
    expect(result.length).toBeGreaterThan(0);
  });

  it("RelationshipQuery: by edgeType", () => {
    const engine = buildDagEngine();
    const result = executeGraphQuery(engine, {
      kind: "RelationshipQuery",
      edgeType: KnowledgeEdgeType.DependsOn,
    }) as GraphRelationship[];
    expect(result).toHaveLength(4);
  });

  it("RelationshipQuery: throws when neither nodeId nor edgeType is supplied", () => {
    const engine = buildDagEngine();
    expect(() => executeGraphQuery(engine, { kind: "RelationshipQuery" })).toThrow(
      GraphValidationException,
    );
  });

  it("DependencyQuery: dependencies direction", () => {
    const engine = buildDagEngine();
    const result = executeGraphQuery(engine, {
      kind: "DependencyQuery",
      nodeId: "A",
      direction: "dependencies",
    }) as string[];
    expect(result.sort()).toEqual(["B", "C", "D"]);
  });

  it("DependencyQuery: dependents direction", () => {
    const engine = buildDagEngine();
    const result = executeGraphQuery(engine, {
      kind: "DependencyQuery",
      nodeId: "D",
      direction: "dependents",
    }) as string[];
    expect(result.sort()).toEqual(["A", "B", "C"]);
  });

  it("AnalyticsQuery: statistics", () => {
    const engine = buildDagEngine();
    const result = executeGraphQuery(engine, {
      kind: "AnalyticsQuery",
      metric: "statistics",
    }) as GraphStatistics;
    expect(result.nodeCount).toBe(4);
  });

  it("AnalyticsQuery: connectedComponents", () => {
    const engine = buildDagEngine();
    const result = executeGraphQuery(engine, {
      kind: "AnalyticsQuery",
      metric: "connectedComponents",
    }) as GraphCluster[];
    expect(result).toHaveLength(1);
  });

  it("AnalyticsQuery: cycles", () => {
    const engine = buildDagEngine();
    const result = executeGraphQuery(engine, {
      kind: "AnalyticsQuery",
      metric: "cycles",
    }) as CycleDetectionResult;
    expect(result.hasCycle).toBe(false);
  });

  it("AnalyticsQuery: averageDegree", () => {
    const engine = buildDagEngine();
    const result = executeGraphQuery(engine, {
      kind: "AnalyticsQuery",
      metric: "averageDegree",
    }) as number;
    expect(result).toBe(2);
  });

  it("AnalyticsQuery: throws on an unknown metric", () => {
    const engine = buildDagEngine();
    expect(() =>
      executeGraphQuery(engine, {
        kind: "AnalyticsQuery",
        // @ts-expect-error -- deliberately invalid for the throw-path test
        metric: "unknown",
      }),
    ).toThrow(GraphValidationException);
  });

  it("throws on an unknown query kind", () => {
    const engine = buildDagEngine();
    expect(() =>
      // @ts-expect-error -- deliberately invalid for the throw-path test
      executeGraphQuery(engine, { kind: "NotAKind" }),
    ).toThrow(GraphValidationException);
  });
});

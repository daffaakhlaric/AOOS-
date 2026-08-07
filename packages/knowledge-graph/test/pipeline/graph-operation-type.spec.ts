import { describe, expect, it } from "vitest";

import { GraphOperationType } from "../../src/pipeline/graph-operation-type.js";

const EXPECTED_OPERATIONS = [
  "CreateGraph",
  "DeleteGraph",
  "CloneGraph",
  "SnapshotGraph",
  "RestoreGraph",
  "MergeGraph",
  "CreateNode",
  "UpdateNode",
  "DeleteNode",
  "MoveNode",
  "CopyNode",
  "FindNode",
  "FindNodes",
  "CreateEdge",
  "UpdateEdge",
  "DeleteEdge",
  "FindEdge",
  "FindEdges",
  "Connect",
  "Disconnect",
  "RelationshipExists",
  "Traversal",
  "BreadthFirstSearch",
  "DepthFirstSearch",
  "ShortestPath",
  "FindNeighbors",
  "FindAncestors",
  "FindDescendants",
  "FindDependencies",
  "FindDependents",
  "ImpactAnalysis",
  "CycleDetection",
  "ConnectedComponents",
  "SubGraph",
  "GraphValidation",
  "GraphStatistics",
];

describe("GraphOperationType", () => {
  it("catalogues every Graph Operation from the specification", () => {
    expect(Object.keys(GraphOperationType).sort()).toEqual([...EXPECTED_OPERATIONS].sort());
  });

  it.each(EXPECTED_OPERATIONS)("%s is a non-empty string value equal to its key", (key) => {
    const value = GraphOperationType[key as keyof typeof GraphOperationType];
    expect(typeof value).toBe("string");
    expect(value).toBe(key);
  });
});

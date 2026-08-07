import { describe, expect, it } from "vitest";

import { GraphEngine } from "../../src/graph/graph-engine.js";
import { mergeGraphs } from "../../src/graph/graph-merge.js";
import { addEdge, addNode } from "../helpers/graph-fixtures.js";

describe("mergeGraphs", () => {
  it("unions disjoint nodes/edges into the target graph", () => {
    const target = GraphEngine.create({ name: "target" });
    addNode(target, "A");
    const source = GraphEngine.create({ name: "source" });
    addNode(source, "B");
    addNode(source, "C");
    addEdge(source, "B", "C");

    const result = mergeGraphs(target, source);

    expect(result.mergedNodeCount).toBe(2);
    expect(result.mergedEdgeCount).toBe(1);
    expect(result.conflictedNodeIds).toEqual([]);
    expect(target.hasNode("B")).toBe(true);
    expect(target.hasNode("C")).toBe(true);
    expect(target.listEdges()).toHaveLength(1);
  });

  it("keep-target (default): target's node wins on id collision", () => {
    const target = GraphEngine.create({ name: "target" });
    addNode(target, "A");
    target.replaceNode({ ...target.getNode("A"), label: "target-label" });
    const source = GraphEngine.create({ name: "source" });
    addNode(source, "A");
    source.replaceNode({ ...source.getNode("A"), label: "source-label" });

    const result = mergeGraphs(target, source, "keep-target");

    expect(result.conflictedNodeIds).toEqual(["A"]);
    expect(target.getNode("A").label).toBe("target-label");
  });

  it("keep-source: source's node overwrites target's node", () => {
    const target = GraphEngine.create({ name: "target" });
    addNode(target, "A");
    target.replaceNode({ ...target.getNode("A"), label: "target-label" });
    const source = GraphEngine.create({ name: "source" });
    addNode(source, "A");
    source.replaceNode({ ...source.getNode("A"), label: "source-label" });

    mergeGraphs(target, source, "keep-source");

    expect(target.getNode("A").label).toBe("source-label");
  });

  it("merge-metadata: shallow-merges metadata, preferring source on key collision", () => {
    const target = GraphEngine.create({ name: "target" });
    addNode(target, "A");
    target.replaceNode({ ...target.getNode("A"), metadata: { keep: 1, override: "target" } });
    const source = GraphEngine.create({ name: "source" });
    addNode(source, "A");
    source.replaceNode({ ...source.getNode("A"), metadata: { override: "source", added: true } });

    mergeGraphs(target, source, "merge-metadata");

    expect(target.getNode("A").metadata).toEqual({ keep: 1, override: "source", added: true });
  });

  it("re-merging the same source is idempotent (no duplicate edges)", () => {
    const target = GraphEngine.create({ name: "target" });
    addNode(target, "A");
    addNode(target, "B");
    const source = GraphEngine.create({ name: "source" });
    addNode(source, "A");
    addNode(source, "B");
    addEdge(source, "A", "B");

    mergeGraphs(target, source);
    const secondResult = mergeGraphs(target, source);

    expect(target.listEdges()).toHaveLength(1);
    expect(secondResult.mergedEdgeCount).toBe(0);
  });

  it("skips edges already present in target by id", () => {
    const target = GraphEngine.create({ name: "target" });
    addNode(target, "A");
    addNode(target, "B");
    addEdge(target, "A", "B");
    const source = GraphEngine.create({ name: "source" });
    addNode(source, "A");
    addNode(source, "B");
    addEdge(source, "A", "B");

    const result = mergeGraphs(target, source);

    expect(result.mergedEdgeCount).toBe(0);
    expect(target.listEdges()).toHaveLength(1);
  });
});

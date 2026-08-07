import { describe, expect, it } from "vitest";

import { KnowledgeLineage } from "../../src/domain/knowledge-lineage.js";
import { VersionLineageException } from "../../src/errors/version-lineage-exception.js";

describe("KnowledgeLineage", () => {
  it("uses assetId as its id", () => {
    const lineage = new KnowledgeLineage("asset-1");
    expect(lineage.id).toBe("asset-1");
  });

  it("starts with no edges", () => {
    const lineage = new KnowledgeLineage("asset-1");
    expect(lineage.edges()).toEqual([]);
  });

  it("addEdge records a parent -> child edge", () => {
    const lineage = new KnowledgeLineage("asset-1");
    const edge = lineage.addEdge("v1", "v2");
    expect(edge.parentVersionId).toBe("v1");
    expect(edge.childVersionId).toBe("v2");
    expect(lineage.edges()).toHaveLength(1);
  });

  it("rejects a self-edge", () => {
    const lineage = new KnowledgeLineage("asset-1");
    expect(() => lineage.addEdge("v1", "v1")).toThrow(VersionLineageException);
  });

  it("rejects a duplicate edge", () => {
    const lineage = new KnowledgeLineage("asset-1");
    lineage.addEdge("v1", "v2");
    expect(() => lineage.addEdge("v1", "v2")).toThrow(VersionLineageException);
  });

  it("allows the same parent to fan out to multiple children", () => {
    const lineage = new KnowledgeLineage("asset-1");
    lineage.addEdge("v1", "v2");
    lineage.addEdge("v1", "v3");
    expect(lineage.childrenOf("v1").sort()).toEqual(["v2", "v3"]);
  });

  it("parentsOf returns direct parents", () => {
    const lineage = new KnowledgeLineage("asset-1");
    lineage.addEdge("v1", "v2");
    expect(lineage.parentsOf("v2")).toEqual(["v1"]);
  });

  it("parentsOf returns empty array for a root version", () => {
    const lineage = new KnowledgeLineage("asset-1");
    expect(lineage.parentsOf("v1")).toEqual([]);
  });

  it("childrenOf returns empty array for a leaf version", () => {
    const lineage = new KnowledgeLineage("asset-1");
    expect(lineage.childrenOf("v1")).toEqual([]);
  });

  it("ancestorsOf walks multiple generations", () => {
    const lineage = new KnowledgeLineage("asset-1");
    lineage.addEdge("v1", "v2");
    lineage.addEdge("v2", "v3");
    expect(lineage.ancestorsOf("v3").sort()).toEqual(["v1", "v2"]);
  });

  it("descendantsOf walks multiple generations", () => {
    const lineage = new KnowledgeLineage("asset-1");
    lineage.addEdge("v1", "v2");
    lineage.addEdge("v2", "v3");
    expect(lineage.descendantsOf("v1").sort()).toEqual(["v2", "v3"]);
  });

  it("ancestorsOf is cycle-safe", () => {
    const lineage = new KnowledgeLineage("asset-1");
    lineage.addEdge("v1", "v2");
    lineage.addEdge("v2", "v3");
    lineage.addEdge("v3", "v1");
    expect(() => lineage.ancestorsOf("v1")).not.toThrow();
    expect(lineage.ancestorsOf("v1").sort()).toEqual(["v2", "v3"]);
  });

  it("edges() returns a defensive copy", () => {
    const lineage = new KnowledgeLineage("asset-1");
    lineage.addEdge("v1", "v2");
    const snapshot = lineage.edges();
    lineage.addEdge("v2", "v3");
    expect(snapshot).toHaveLength(1);
  });
});

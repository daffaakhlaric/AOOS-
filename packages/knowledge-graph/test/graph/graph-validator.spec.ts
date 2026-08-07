import { describe, expect, it } from "vitest";

import { validateGraph } from "../../src/graph/graph-validator.js";
import { buildDagEngine } from "../helpers/graph-fixtures.js";

describe("validateGraph", () => {
  it("reports a well-formed graph as valid with no issues", () => {
    const engine = buildDagEngine();
    const report = validateGraph(engine);
    expect(report.valid).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.graphId).toBe(engine.graph.id);
    expect(typeof report.validatedAt).toBe("number");
  });

  it("flags a self-loop edge", () => {
    const engine = buildDagEngine();
    engine.addEdge({
      id: "self-loop",
      type: engine.getEdge("DependsOn:A->B").type,
      sourceNodeId: "A",
      targetNodeId: "A",
      weight: 1,
      metadata: {},
      createdAt: 0,
      updatedAt: 0,
    });
    const report = validateGraph(engine);
    expect(report.valid).toBe(false);
    expect(report.issues.some((issue) => issue.kind === "self-loop")).toBe(true);
  });

  it("flags a dangling edge source/target when the graph is assembled outside normal CRUD", () => {
    const engine = buildDagEngine();
    // Directly corrupt the aggregate's edge map to simulate an externally-modified snapshot.
    engine.graph.edges.set("dangling", {
      id: "dangling",
      type: engine.getEdge("DependsOn:A->B").type,
      sourceNodeId: "does-not-exist-source",
      targetNodeId: "does-not-exist-target",
      weight: 1,
      metadata: {},
      createdAt: 0,
      updatedAt: 0,
    });
    const report = validateGraph(engine);
    expect(report.valid).toBe(false);
    expect(report.issues.some((issue) => issue.kind === "dangling-edge-source")).toBe(true);
    expect(report.issues.some((issue) => issue.kind === "dangling-edge-target")).toBe(true);
  });
});

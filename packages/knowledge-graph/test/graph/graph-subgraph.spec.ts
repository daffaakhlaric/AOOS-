import { describe, expect, it } from "vitest";

import { extractSubGraph } from "../../src/graph/graph-subgraph.js";
import { buildDagEngine } from "../helpers/graph-fixtures.js";

describe("extractSubGraph", () => {
  it("includes only the requested nodes and edges whose both endpoints are included", () => {
    const source = buildDagEngine();
    const sub = extractSubGraph(source, ["A", "B", "C"], "Sub");

    expect(sub.graph.name).toBe("Sub");
    expect(
      sub
        .listNodes()
        .map((n) => n.id)
        .sort(),
    ).toEqual(["A", "B", "C"]);
    // A->B, B->C, A->C all qualify (D is excluded, so C->D must NOT appear).
    expect(sub.listEdges()).toHaveLength(3);
    expect(sub.hasNode("D")).toBe(false);
  });

  it("silently skips node ids that do not exist in the source graph", () => {
    const source = buildDagEngine();
    const sub = extractSubGraph(source, ["A", "does-not-exist"], "Sub");
    expect(sub.listNodes().map((n) => n.id)).toEqual(["A"]);
  });

  it("excludes edges whose endpoint was skipped (e.g. missing from source)", () => {
    const source = buildDagEngine();
    const sub = extractSubGraph(source, ["A"], "Sub");
    expect(sub.listEdges()).toHaveLength(0);
  });

  it("produces an empty graph for an empty node id list", () => {
    const source = buildDagEngine();
    const sub = extractSubGraph(source, [], "Empty");
    expect(sub.listNodes()).toHaveLength(0);
    expect(sub.listEdges()).toHaveLength(0);
  });
});

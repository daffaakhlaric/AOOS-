import { describe, expect, it } from "vitest";

import { analyzeImpact } from "../../src/reasoning/impact-analysis.js";
import { buildDagEngine } from "../helpers/graph-fixtures.js";

describe("analyzeImpact", () => {
  it("reports every node that transitively depends on the changed node", () => {
    const engine = buildDagEngine();
    const result = analyzeImpact(engine, "D");
    expect(result.nodeId).toBe("D");
    expect(result.impactedNodeIds.sort()).toEqual(["A", "B", "C"]);
    expect(result.impactedCount).toBe(3);
  });

  it("a node nothing depends on has zero impact", () => {
    const engine = buildDagEngine();
    const result = analyzeImpact(engine, "A");
    expect(result.impactedNodeIds).toEqual([]);
    expect(result.impactedCount).toBe(0);
  });
});

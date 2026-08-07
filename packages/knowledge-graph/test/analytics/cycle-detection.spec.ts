import { describe, expect, it } from "vitest";

import { detectCycles, wouldCreateCycle } from "../../src/analytics/cycle-detection.js";
import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { HIERARCHICAL_EDGE_TYPES } from "../../src/edges/edge-type-semantics.js";
import { GraphEngine } from "../../src/graph/graph-engine.js";
import {
  addEdge,
  buildCycleCandidateEngine,
  buildDagEngine,
  buildGraphWithExistingCycle,
} from "../helpers/graph-fixtures.js";

describe("detectCycles", () => {
  it("a DAG has no cycles", () => {
    const engine = buildDagEngine();
    const result = detectCycles(engine);
    expect(result.hasCycle).toBe(false);
    expect(result.cycleCount).toBe(0);
    expect(result.cycles).toEqual([]);
  });

  it("detects an existing 3-node cycle", () => {
    const engine = buildGraphWithExistingCycle();
    const result = detectCycles(engine);
    expect(result.hasCycle).toBe(true);
    expect(result.cycleCount).toBe(1);
    expect(result.cycles[0]).toContain("P");
    expect(result.cycles[0]).toContain("Q");
    expect(result.cycles[0]).toContain("R");
  });

  it("restricts detection to the supplied edge types", () => {
    const engine = buildGraphWithExistingCycle();
    const result = detectCycles(engine, new Set([KnowledgeEdgeType.RelatedTo]));
    expect(result.hasCycle).toBe(false);
  });

  it("returns no cycles for an empty graph", () => {
    const engine = GraphEngine.create({ name: "empty" });
    expect(detectCycles(engine).hasCycle).toBe(false);
  });

  it("handles a self-loop as a 1-node cycle", () => {
    const engine = GraphEngine.create({ name: "self-loop" });
    engine.addNode({
      id: "S",
      type: buildDagEngine().getNode("A").type,
      label: "S",
      metadata: {},
      createdAt: 0,
      updatedAt: 0,
    });
    engine.addEdge({
      id: "self",
      type: KnowledgeEdgeType.RelatedTo,
      sourceNodeId: "S",
      targetNodeId: "S",
      weight: 1,
      metadata: {},
      createdAt: 0,
      updatedAt: 0,
    });
    const result = detectCycles(engine);
    expect(result.hasCycle).toBe(true);
  });
});

describe("wouldCreateCycle", () => {
  it("true when the target can already reach the source (proposed Z -> X closes X -> Y -> Z)", () => {
    const engine = buildCycleCandidateEngine();
    expect(wouldCreateCycle(engine, "Z", "X", HIERARCHICAL_EDGE_TYPES)).toBe(true);
  });

  it("false when the target cannot reach the source", () => {
    const engine = buildCycleCandidateEngine();
    expect(wouldCreateCycle(engine, "Z", "W", HIERARCHICAL_EDGE_TYPES)).toBe(false);
  });

  it("true for a proposed self-loop", () => {
    const engine = buildCycleCandidateEngine();
    expect(wouldCreateCycle(engine, "X", "X", HIERARCHICAL_EDGE_TYPES)).toBe(true);
  });

  it("only considers edges of the supplied types when walking reachability", () => {
    const engine = buildCycleCandidateEngine();
    // Z -> X exists only as a RelatedTo edge.
    addEdge(engine, "Z", "X", KnowledgeEdgeType.RelatedTo);
    // Restricted to DependsOn, the RelatedTo edge is invisible, so no cycle is detected.
    expect(wouldCreateCycle(engine, "X", "Z", new Set([KnowledgeEdgeType.DependsOn]))).toBe(false);
    // Once RelatedTo is included in the checked set, the same edge makes the cycle visible.
    expect(
      wouldCreateCycle(
        engine,
        "X",
        "Z",
        new Set([KnowledgeEdgeType.DependsOn, KnowledgeEdgeType.RelatedTo]),
      ),
    ).toBe(true);
  });
});

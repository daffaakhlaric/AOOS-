import { describe, expect, it } from "vitest";

import { buildExecutionGraph } from "../../src/graph/execution-graph.js";
import {
  detectCycles,
  detectDeadEnds,
  detectInfiniteLoopRisks,
  detectOrphanNodes,
} from "../../src/graph/graph-analyzer.js";
import {
  brokenDefinitionFixture,
  definitionFixture,
  loopDefinitionFixture,
} from "../helpers/definition-fixture.js";

describe("Graph Test — graph-analyzer", () => {
  it("detectDeadEnds() finds a non-End Node with zero outgoing edges", () => {
    const graph = buildExecutionGraph(brokenDefinitionFixture());
    expect(detectDeadEnds(graph)).toContain("dead-end");
  });

  it("detectOrphanNodes() finds a non-Start Node with zero incoming edges", () => {
    const graph = buildExecutionGraph(brokenDefinitionFixture());
    expect(detectOrphanNodes(graph)).toContain("orphan");
  });

  it("detectDeadEnds()/detectOrphanNodes() are empty for a well-formed linear Definition", () => {
    const graph = buildExecutionGraph(definitionFixture());
    expect(detectDeadEnds(graph)).toEqual([]);
    expect(detectOrphanNodes(graph)).toEqual([]);
  });

  it("detectCycles() finds the Loop Node's own body/back-edge cycle", () => {
    const graph = buildExecutionGraph(loopDefinitionFixture());
    const cycles = detectCycles(graph);
    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles.some((cycle) => cycle.includes("loop-1") && cycle.includes("body-1"))).toBe(true);
  });

  it("detectInfiniteLoopRisks() excludes cycles that pass through a declared Loop Node", () => {
    const graph = buildExecutionGraph(loopDefinitionFixture());
    expect(detectInfiniteLoopRisks(graph)).toEqual([]);
  });

  it("detectInfiniteLoopRisks() reports a cycle with no Loop Node involved", () => {
    const graph = buildExecutionGraph(definitionFixture());
    const cyclic = {
      ...graph,
      edgesByFromNode: new Map(graph.edgesByFromNode).set("end", [
        {
          transitionId: "back",
          kind: graph.edgesByFromNode.get("start")![0]!.kind,
          fromNodeId: "end",
          toNodeId: "start",
        },
      ]),
    };
    expect(detectInfiniteLoopRisks(cyclic).length).toBeGreaterThan(0);
  });
});

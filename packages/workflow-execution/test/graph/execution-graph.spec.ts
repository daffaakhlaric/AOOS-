import { TransitionKind } from "@aos/workflow-definition";
import { describe, expect, it } from "vitest";

import { buildExecutionGraph } from "../../src/graph/execution-graph.js";
import {
  definitionFixture,
  loopDefinitionFixture,
  parallelDefinitionFixture,
} from "../helpers/definition-fixture.js";

describe("Graph Test — buildExecutionGraph", () => {
  it("resolves startNodeId and endNodeIds from a linear Definition", () => {
    const graph = buildExecutionGraph(definitionFixture());
    expect(graph.startNodeId).toBe("start");
    expect(graph.endNodeIds.has("end")).toBe(true);
    expect(graph.nodeIds).toEqual(["start", "cap-1", "end"]);
  });

  it("indexes edges by from-node and to-node", () => {
    const graph = buildExecutionGraph(definitionFixture());
    expect(graph.edgesByFromNode.get("start")).toHaveLength(1);
    expect(graph.edgesByFromNode.get("start")?.[0]).toMatchObject({
      toNodeId: "cap-1",
      kind: TransitionKind.NEXT,
    });
    expect(graph.edgesByToNode.get("end")).toHaveLength(1);
  });

  it("adds synthetic LOOP-kind body/back edges for Loop Nodes", () => {
    const graph = buildExecutionGraph(loopDefinitionFixture());
    expect(graph.loopNodeIds.has("loop-1")).toBe(true);
    const outgoingFromLoop = graph.edgesByFromNode.get("loop-1") ?? [];
    expect(
      outgoingFromLoop.some(
        (edge) => edge.kind === TransitionKind.LOOP && edge.toNodeId === "body-1",
      ),
    ).toBe(true);
    const outgoingFromBody = graph.edgesByFromNode.get("body-1") ?? [];
    expect(
      outgoingFromBody.some(
        (edge) => edge.kind === TransitionKind.LOOP && edge.toNodeId === "loop-1",
      ),
    ).toBe(true);
  });

  it("captures fan-out PARALLEL and fan-in MERGE edges", () => {
    const graph = buildExecutionGraph(parallelDefinitionFixture());
    expect(graph.edgesByFromNode.get("start")).toHaveLength(2);
    expect(graph.edgesByToNode.get("end")).toHaveLength(2);
  });
});

import { describe, expect, it } from "vitest";

import { buildExecutionGraph } from "../../src/graph/execution-graph.js";
import { TransitionValidator } from "../../src/validator/transition-validator.js";
import { definitionFixture } from "../helpers/definition-fixture.js";
import { sessionFixture } from "../helpers/session-fixture.js";

describe("Validator Test — TransitionValidator", () => {
  it("passes when every Transition resolves to a known Node id", () => {
    const { session } = sessionFixture({ definition: definitionFixture() });
    const graph = buildExecutionGraph(session.definition);
    expect(new TransitionValidator().validate({ session, graph }).valid).toBe(true);
  });

  it("flags a Transition referencing an unknown toNodeId", () => {
    const { session } = sessionFixture({ definition: definitionFixture() });
    const graph = buildExecutionGraph(session.definition);
    const badGraph = {
      ...graph,
      edgesByFromNode: new Map(graph.edgesByFromNode).set("cap-1", [
        {
          transitionId: "bad",
          kind: graph.edgesByFromNode.get("start")![0]!.kind,
          fromNodeId: "cap-1",
          toNodeId: "ghost",
        },
      ]),
    };
    const result = new TransitionValidator().validate({ session, graph: badGraph });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("ghost"))).toBe(true);
  });

  it("flags an edge map keyed by an unknown fromNodeId", () => {
    const { session } = sessionFixture({ definition: definitionFixture() });
    const graph = buildExecutionGraph(session.definition);
    const badGraph = {
      ...graph,
      edgesByFromNode: new Map(graph.edgesByFromNode).set("ghost-source", [
        {
          transitionId: "bad",
          kind: graph.edgesByFromNode.get("start")![0]!.kind,
          fromNodeId: "ghost-source",
          toNodeId: "end",
        },
      ]),
    };
    const result = new TransitionValidator().validate({ session, graph: badGraph });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("ghost-source"))).toBe(true);
  });
});

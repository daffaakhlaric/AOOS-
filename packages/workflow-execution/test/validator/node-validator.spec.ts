import { describe, expect, it } from "vitest";

import { buildExecutionGraph } from "../../src/graph/execution-graph.js";
import { NodeValidator } from "../../src/validator/node-validator.js";
import { definitionFixture } from "../helpers/definition-fixture.js";
import { sessionFixture } from "../helpers/session-fixture.js";

describe("Validator Test — NodeValidator", () => {
  it("passes for a Definition with exactly one Start and at least one End Node", () => {
    const { session } = sessionFixture({ definition: definitionFixture() });
    const graph = buildExecutionGraph(session.definition);
    expect(new NodeValidator().validate({ session, graph }).valid).toBe(true);
  });

  it("flags a missing End Node", () => {
    const { session } = sessionFixture({ definition: definitionFixture() });
    const graph = buildExecutionGraph(session.definition);
    const noEndGraph = { ...graph, endNodeIds: new Set<string>() };
    const result = new NodeValidator().validate({ session, graph: noEndGraph });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("End Node"))).toBe(true);
  });

  it("flags an unresolvable Start Node", () => {
    const { session } = sessionFixture({ definition: definitionFixture() });
    const graph = buildExecutionGraph(session.definition);
    const noStartGraph = { ...graph, startNodeId: "" };
    const result = new NodeValidator().validate({ session, graph: noStartGraph });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("Start Node"))).toBe(true);
  });
});

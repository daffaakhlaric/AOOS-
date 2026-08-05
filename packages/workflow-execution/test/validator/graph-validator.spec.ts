import { describe, expect, it } from "vitest";

import { buildExecutionGraph } from "../../src/graph/execution-graph.js";
import { GraphValidator } from "../../src/validator/graph-validator.js";
import {
  brokenDefinitionFixture,
  definitionFixture,
  loopDefinitionFixture,
} from "../helpers/definition-fixture.js";
import { sessionFixture } from "../helpers/session-fixture.js";

describe("Validator Test — GraphValidator", () => {
  it("reports no issues for a well-formed linear Definition", () => {
    const { session } = sessionFixture({ definition: definitionFixture() });
    const graph = buildExecutionGraph(session.definition);
    const result = new GraphValidator().validate({ session, graph });
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("reports dead-end and orphan Node issues for a broken Definition", () => {
    const { session } = sessionFixture({ definition: brokenDefinitionFixture() });
    const graph = buildExecutionGraph(session.definition);
    const result = new GraphValidator().validate({ session, graph });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("dead end"))).toBe(true);
    expect(result.issues.some((issue) => issue.message.includes("orphaned"))).toBe(true);
  });

  it("does not flag a Loop Node's sanctioned cycle as an infinite loop risk", () => {
    const { session } = sessionFixture({ definition: loopDefinitionFixture() });
    const graph = buildExecutionGraph(session.definition);
    const result = new GraphValidator().validate({ session, graph });
    expect(result.valid).toBe(true);
  });
});

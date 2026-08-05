import { describe, expect, it } from "vitest";

import { buildExecutionGraph } from "../../src/graph/execution-graph.js";
import { TimeoutValidator } from "../../src/validator/timeout-validator.js";
import { definitionFixture } from "../helpers/definition-fixture.js";
import { sessionFixture } from "../helpers/session-fixture.js";

describe("Validator Test — TimeoutValidator", () => {
  it("passes when no timeouts are configured", () => {
    const { session } = sessionFixture({ definition: definitionFixture() });
    const graph = buildExecutionGraph(session.definition);
    expect(new TimeoutValidator().validate({ session, graph }).valid).toBe(true);
  });

  it("passes when every configured timeout is a positive number", () => {
    const { session } = sessionFixture({ definition: definitionFixture() });
    const graph = buildExecutionGraph(session.definition);
    const result = new TimeoutValidator().validate({
      session,
      graph,
      timeouts: { workflowTimeoutMs: 1000, nodeTimeoutMs: 500 },
    });
    expect(result.valid).toBe(true);
  });

  it("flags a zero or negative timeout value", () => {
    const { session } = sessionFixture({ definition: definitionFixture() });
    const graph = buildExecutionGraph(session.definition);
    const result = new TimeoutValidator().validate({
      session,
      graph,
      timeouts: { nodeTimeoutMs: -5 },
    });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toBe("timeouts.nodeTimeoutMs");
  });
});

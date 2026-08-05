import { describe, expect, it } from "vitest";

import { buildExecutionGraph } from "../../src/graph/execution-graph.js";
import { RetryStrategy } from "../../src/retry/retry-policy.js";
import { RetryValidator } from "../../src/validator/retry-validator.js";
import { definitionFixture } from "../helpers/definition-fixture.js";
import { sessionFixture } from "../helpers/session-fixture.js";

describe("Validator Test — RetryValidator", () => {
  it("passes when no Retry Policy is configured", () => {
    const { session } = sessionFixture({ definition: definitionFixture() });
    const graph = buildExecutionGraph(session.definition);
    expect(new RetryValidator().validate({ session, graph }).valid).toBe(true);
  });

  it("flags a non-positive maxAttempts", () => {
    const { session } = sessionFixture({ definition: definitionFixture() });
    const graph = buildExecutionGraph(session.definition);
    const result = new RetryValidator().validate({
      session,
      graph,
      retryPolicy: { strategy: RetryStrategy.IMMEDIATE, maxAttempts: 0 },
    });
    expect(result.valid).toBe(false);
  });

  it("flags a CUSTOM strategy with no customDelayFn", () => {
    const { session } = sessionFixture({ definition: definitionFixture() });
    const graph = buildExecutionGraph(session.definition);
    const result = new RetryValidator().validate({
      session,
      graph,
      retryPolicy: { strategy: RetryStrategy.CUSTOM, maxAttempts: 3 },
    });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toBe("retryPolicy.customDelayFn");
  });

  it("passes a CUSTOM strategy that does supply a customDelayFn", () => {
    const { session } = sessionFixture({ definition: definitionFixture() });
    const graph = buildExecutionGraph(session.definition);
    const result = new RetryValidator().validate({
      session,
      graph,
      retryPolicy: { strategy: RetryStrategy.CUSTOM, maxAttempts: 3, customDelayFn: () => 10 },
    });
    expect(result.valid).toBe(true);
  });
});
